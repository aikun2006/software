' 灵山导览 —— 一键启动公网隧道（自动确保本地服务器已运行）
' 双击即可：后台启动 server.py（如未运行）+ cloudflared，弹窗显示公网网址并复制到剪贴板。
' 隧道在后台无窗口运行，关闭弹窗不影响；停止请用 停止隧道.vbs。
Option Explicit
Dim sh, fso, baseDir, appDir, exePath, outFile, errFile
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir  = fso.BuildPath(baseDir, "software")
exePath = fso.BuildPath(baseDir, "cloudflared.exe")
outFile = fso.BuildPath(baseDir, "tunnel.log")
errFile = fso.BuildPath(baseDir, "tunnel-err.log")

' ---- 判断某端口是否在监听 ----
Sub CheckPort(port, ByRef busy)
    Dim f
    f = baseDir & "\_chk.tmp"
    If fso.FileExists(f) Then fso.DeleteFile f
    sh.Run "cmd /c netstat -ano | findstr :" & port & " | findstr LISTENING > """ & f & """", 0, True
    busy = False
    If fso.FileExists(f) Then
        If fso.GetFile(f).Size > 0 Then busy = True
        fso.DeleteFile f
    End If
End Sub

' ---- 判断进程是否在运行 ----
Function IsRunning(imageName)
    Dim f
    f = baseDir & "\_proc.tmp"
    If fso.FileExists(f) Then fso.DeleteFile f
    sh.Run "cmd /c tasklist /nh | findstr /i """ & imageName & """ > """ & f & """", 0, True
    IsRunning = False
    If fso.FileExists(f) Then
        If fso.GetFile(f).Size > 0 Then IsRunning = True
        fso.DeleteFile f
    End If
End Function

' ---- 从日志里提取公网网址 ----
Function ExtractURL()
    Dim ts, content, re, m
    content = ""
    If fso.FileExists(errFile) Then
        On Error Resume Next
        Set ts = fso.OpenTextFile(errFile, 1)
        content = ts.ReadAll
        ts.Close
        On Error GoTo 0
    End If
    Set re = New RegExp
    re.Pattern = "https://[a-z0-9-]+\.trycloudflare\.com"
    re.IgnoreCase = True
    Set m = re.Execute(content)
    If m.Count > 0 Then
        ExtractURL = m(0).Value
    Else
        ExtractURL = ""
    End If
End Function

' ===== 1. 确保本地 server.py 已运行（如未运行则启动）=====
Dim portBusy
CheckPort 8080, portBusy
If Not portBusy Then
    If Not fso.FileExists(fso.BuildPath(appDir, "server.py")) Then
        sh.Popup "未找到 software\server.py，无法启动服务器。", 0, "灵山导览", 16
        WScript.Quit 1
    End If
    sh.CurrentDirectory = appDir
    sh.Run "cmd /c python server.py > server.log 2>&1", 0, False
    Dim tries
    For tries = 1 To 15
        WScript.Sleep 1000
        CheckPort 8080, portBusy
        If portBusy Then Exit For
    Next
End If
If Not portBusy Then
    sh.Popup "本地服务器启动失败。请查看 software\server.log。", 0, "灵山导览", 16
    WScript.Quit 1
End If

' ===== 2. 启动 cloudflared（若未运行）=====
Dim cfRunning
cfRunning = IsRunning("cloudflared.exe")
If Not cfRunning Then
    If Not fso.FileExists(exePath) Then
        sh.Popup "未找到 cloudflared.exe：" & vbCrLf & exePath, 0, "灵山导览", 16
        WScript.Quit 1
    End If
    ' 清旧日志，便于抓新网址
    If fso.FileExists(outFile) Then fso.DeleteFile outFile
    If fso.FileExists(errFile) Then fso.DeleteFile errFile
    sh.CurrentDirectory = baseDir
    sh.Run "cmd /c cloudflared.exe tunnel --url http://localhost:8080 > tunnel.log 2>&1", 0, False
End If

' ===== 3. 等待并提取网址 =====
Dim urlStr, t
urlStr = ""
For t = 1 To 25
    WScript.Sleep 1000
    urlStr = ExtractURL()
    If urlStr <> "" Then Exit For
Next

' ===== 4. 弹窗 + 复制剪贴板 =====
If urlStr <> "" Then
    sh.Run "cmd /c echo " & urlStr & "| clip", 0, True
    sh.Popup "公网隧道已启动！" & vbCrLf & vbCrLf & _
             "网址（已复制到剪贴板）：" & vbCrLf & urlStr & vbCrLf & vbCrLf & _
             "访问口令：lingshan2026" & vbCrLf & vbCrLf & _
             "把网址 + 口令一起发给别人即可。" & vbCrLf & _
             "隧道后台运行，关掉本弹窗不影响。", 0, "灵山导览 公网隧道", 64
Else
    sh.Popup "隧道已启动，但网址还没抓到。" & vbCrLf & _
             "请等几秒后再双击本文件，或查看：" & vbCrLf & errFile, 0, "灵山导览", 48
End If
