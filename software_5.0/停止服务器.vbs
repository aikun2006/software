' 灵山导览 —— 停止后台服务器（调用 /api/shutdown 优雅退出）
Option Explicit
Dim sh, fso, baseDir, appDir
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir  = fso.BuildPath(baseDir, "software")
sh.CurrentDirectory = appDir

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
If Not busy Then
    sh.Popup "服务器未在运行（8080 端口空闲）。", 4, "灵山导览", 48
Else
    On Error Resume Next
    Dim req
    Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
    req.SetTimeouts 8000, 8000, 8000, 8000
    req.Open "POST", "http://localhost:8080/api/shutdown", False
    req.Send "{}"
    If Err.Number = 0 Then
        WScript.Sleep 1500
        Dim still
        CheckPort still
        If Not still Then
            sh.Popup "服务器已停止。", 3, "灵山导览", 64
        Else
            sh.Popup "已发送关闭请求，但端口仍被占用。" & vbCrLf & _
                     "可再次双击本文件，或稍候重启电脑。", 6, "灵山导览", 48
        End If
    Else
        sh.Popup "无法连接服务器（可能已停止）。" & vbCrLf & _
                 "错误：" & Err.Description, 6, "灵山导览", 48
    End If
    On Error GoTo 0
End If
