param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Public = Join-Path $Root "public"
$TtlMs = 24 * 60 * 60 * 1000
$Users = @{}
$Messages = New-Object System.Collections.ArrayList

function New-HttpResponse([int]$Status, [string]$ContentType, [byte[]]$Body) {
  $Reason = switch ($Status) {
    200 { "OK" }
    201 { "Created" }
    400 { "Bad Request" }
    403 { "Forbidden" }
    404 { "Not Found" }
    405 { "Method Not Allowed" }
    default { "Internal Server Error" }
  }
  $Headers = @(
    "HTTP/1.1 $Status $Reason"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Cache-Control: no-store"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"
  $HeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($Headers)
  $Bytes = New-Object byte[] ($HeaderBytes.Length + $Body.Length)
  [Array]::Copy($HeaderBytes, 0, $Bytes, 0, $HeaderBytes.Length)
  [Array]::Copy($Body, 0, $Bytes, $HeaderBytes.Length, $Body.Length)
  return $Bytes
}

function Json-Response([int]$Status, $Body) {
  $Json = $Body | ConvertTo-Json -Depth 30 -Compress
  return New-HttpResponse $Status "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($Json))
}

function Text-Response([int]$Status, [string]$Text) {
  return New-HttpResponse $Status "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-PublicUsers {
  $List = New-Object System.Collections.ArrayList
  foreach ($User in $Users.Values) { [void]$List.Add($User) }
  return $List
}

function Remove-Expired {
  $Now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  for ($Index = $Messages.Count - 1; $Index -ge 0; $Index--) {
    if ([int64]$Messages[$Index].expiresAt -le $Now) {
      $Messages.RemoveAt($Index)
    }
  }
}

function Parse-Request([System.Net.Sockets.NetworkStream]$Stream) {
  $Buffer = New-Object byte[] 65536
  $Data = New-Object System.Collections.Generic.List[byte]
  $HeaderEnd = -1

  while ($HeaderEnd -lt 0) {
    $Read = $Stream.Read($Buffer, 0, $Buffer.Length)
    if ($Read -le 0) { break }
    for ($i = 0; $i -lt $Read; $i++) { $Data.Add($Buffer[$i]) }
    $Bytes = $Data.ToArray()
    for ($i = 0; $i -le $Bytes.Length - 4; $i++) {
      if ($Bytes[$i] -eq 13 -and $Bytes[$i + 1] -eq 10 -and $Bytes[$i + 2] -eq 13 -and $Bytes[$i + 3] -eq 10) {
        $HeaderEnd = $i + 4
        break
      }
    }
  }

  if ($HeaderEnd -lt 0) { return $null }

  $AllBytes = $Data.ToArray()
  $HeaderText = [System.Text.Encoding]::ASCII.GetString($AllBytes, 0, $HeaderEnd)
  $Lines = $HeaderText -split "`r`n"
  $RequestParts = $Lines[0] -split " "
  $Headers = @{}
  foreach ($Line in $Lines[1..($Lines.Count - 1)]) {
    if ($Line -match "^([^:]+):\s*(.*)$") {
      $Headers[$Matches[1].ToLowerInvariant()] = $Matches[2]
    }
  }

  $ContentLength = if ($Headers.ContainsKey("content-length")) { [int]$Headers["content-length"] } else { 0 }
  $BodyBytes = New-Object byte[] $ContentLength
  $Already = [Math]::Max(0, $AllBytes.Length - $HeaderEnd)
  if ($Already -gt 0) {
    [Array]::Copy($AllBytes, $HeaderEnd, $BodyBytes, 0, [Math]::Min($Already, $ContentLength))
  }
  $Offset = [Math]::Min($Already, $ContentLength)
  while ($Offset -lt $ContentLength) {
    $Read = $Stream.Read($BodyBytes, $Offset, $ContentLength - $Offset)
    if ($Read -le 0) { break }
    $Offset += $Read
  }

  return @{
    method = $RequestParts[0]
    path = ($RequestParts[1] -split "\?")[0]
    body = [System.Text.Encoding]::UTF8.GetString($BodyBytes)
  }
}

function Read-JsonBody([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return @{} }
  return $Text | ConvertFrom-Json -Depth 30
}

function Serve-Static([string]$Path) {
  if ($Path -eq "/") { $Path = "/index.html" }
  $Decoded = [Uri]::UnescapeDataString($Path)
  $Relative = $Decoded.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $File = [System.IO.Path]::GetFullPath((Join-Path $Public $Relative))
  $PublicFull = [System.IO.Path]::GetFullPath($Public)

  if (-not $File.StartsWith($PublicFull)) { return Text-Response 403 "Forbidden" }
  if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { return Text-Response 404 "Not found" }

  $Ext = [System.IO.Path]::GetExtension($File).ToLowerInvariant()
  $Types = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
  }
  $ContentType = if ($Types.ContainsKey($Ext)) { $Types[$Ext] } else { "application/octet-stream" }
  return New-HttpResponse 200 $ContentType ([System.IO.File]::ReadAllBytes($File))
}

function Handle-Request($Request) {
  Remove-Expired
  $Method = $Request.method
  $Route = $Request.path

  if ($Method -eq "GET" -and $Route -eq "/api/bootstrap") {
    return Json-Response 200 @{
      users = Get-PublicUsers
      messages = @($Messages)
      ttlMs = $TtlMs
      serverStoresPlaintext = $false
    }
  }

  if ($Method -eq "POST" -and $Route -eq "/api/register") {
    $Body = Read-JsonBody $Request.body
    if (-not $Body.name -or -not $Body.publicKey) {
      return Json-Response 400 @{ error = "name and publicKey are required" }
    }
    $Id = if ($Body.id) { [string]$Body.id } else { [guid]::NewGuid().ToString() }
    $Name = [string]$Body.name
    $User = [ordered]@{
      id = $Id
      name = $Name.Substring(0, [Math]::Min(60, $Name.Length))
      publicKey = $Body.publicKey
      color = if ($Body.color) { [string]$Body.color } else { "#2f8f83" }
      registeredAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      lastSeenAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    $Users[$Id] = $User
    return Json-Response 200 @{ user = $User; users = Get-PublicUsers }
  }

  if ($Method -eq "POST" -and $Route -eq "/api/message") {
    $Body = Read-JsonBody $Request.body
    $Required = @("senderId", "recipientId", "ciphertext", "iv", "senderPublicKey")
    $Missing = $Required | Where-Object { -not $Body.$_ }
    if ($Missing.Count -gt 0) {
      return Json-Response 400 @{ error = "encrypted message envelope is incomplete" }
    }
    if (-not $Users.ContainsKey([string]$Body.senderId) -or -not $Users.ContainsKey([string]$Body.recipientId)) {
      return Json-Response 404 @{ error = "sender or recipient is not registered" }
    }
    $Now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $Message = [ordered]@{
      id = [guid]::NewGuid().ToString()
      senderId = [string]$Body.senderId
      recipientId = [string]$Body.recipientId
      senderPublicKey = $Body.senderPublicKey
      ciphertext = [string]$Body.ciphertext
      iv = [string]$Body.iv
      createdAt = $Now
      expiresAt = $Now + $TtlMs
    }
    [void]$Messages.Add($Message)
    return Json-Response 201 @{ message = $Message }
  }

  if ($Method -eq "POST" -and $Route -eq "/api/clear") {
    $Messages.Clear()
    return Json-Response 200 @{ ok = $true }
  }

  if ($Method -eq "GET") { return Serve-Static $Route }
  return Json-Response 405 @{ error = "method not allowed" }
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$Listener.Start()
Write-Host "ANDO is running at http://localhost:$Port/"

try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Request = Parse-Request $Stream
      $Response = if ($null -eq $Request) { Text-Response 400 "Bad request" } else { Handle-Request $Request }
      $Stream.Write($Response, 0, $Response.Length)
    } catch {
      $Response = Json-Response 500 @{ error = $_.Exception.Message }
      if ($Stream) { $Stream.Write($Response, 0, $Response.Length) }
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
