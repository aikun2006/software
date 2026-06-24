' 灵山导览 —— 单服务器无窗口启动（前端 + AI + 语音 一体，端口 8080）
' 双击本文件即可后台启动，全程无 cmd 窗口。
Option Explicit
Dim sh, fso, baseDir, appDir
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir  = fso.BuildPath(baseDir, "software")
sh.CurrentDirectory = appDir

' 端口占用检测：把 netstat 中监听 8080 的行写入 chk.tmp，按文件大小判断是否占用。
Sub CheckPort(ByRef busy)
    Dim f
    f = appDir & "\chk.tmp"
    If fso.FileExists(f) Then fso.DeleteFile f
    sh.Run "cmd /c netstat -ano | findstr :8080 | findstr LISTENING > chk.tmp", 0, True
    busy = False
    If fso.FileExists(f) Then
        If fso.GetFile(f).Size > 0 Then busy = True
        fso.DeleteFile f
    End If
End Sub

Dim busy
CheckPort busy
If busy Then
    sh.Popup "服务器已在运行中（8080 端口被占用）。" & vbCrLf & vbCrLf & _
             "浏览器访问：http://localhost:8080" & vbCrLf & _
             "如需重启：请先双击 停止服务器.vbs", 6, "灵山导览", 48
Else
    ' 后台无窗口启动，stdout 重定向到 server.log（保留运行/AI 连接日志）
    sh.Run "cmd /c python server.py > server.log 2>&1", 0, False
    Dim up, tries
    up = False
    For tries = 1 To 8
        WScript.Sleep 1000
        CheckPort up
        If up Then Exit For
    Next
    If up Then
        sh.Popup "服务器已在后台启动（无窗口）。" & vbCrLf & vbCrLf & _
                 "浏览器访问：http://localhost:8080" & vbCrLf & _
                 "停止：双击 停止服务器.vbs", 5, "灵山导览", 64
    Else
        sh.Popup "启动失败。请打开 software\server.log 查看错误，" & vbCrLf & _
                 "或在命令行运行：python software\server.py 排查。", 8, "灵山导览", 16
    End If
End If
