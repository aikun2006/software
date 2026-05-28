$shell = New-Object -ComObject Shell.Application
$zip = $shell.NameSpace("d:\2026比赛\26软件杯相关\software\示范景区公开资料包\灵山胜境：历史、文化、景点特色与个性化游览指南.docx")
$item = $zip.ParseName("word\\document.xml")
$xmlContent = $zip.GetDetailsOf($item, 0)

# Try different encodings
$encodings = @('UTF-8', 'GB2312', 'GBK', 'BigEndianUnicode', 'Unicode')

foreach ($enc in $encodings) {
    try {
        $bytes = [System.Text.Encoding]::GetEncoding($enc).GetBytes($xmlContent)
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($text -match '灵山|历史|文化') {
            Write-Host "Match found with encoding: $enc"
            Write-Host $text
            break
        }
    } catch {
        Write-Host "Failed with $enc"
    }
}