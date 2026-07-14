' 灵山导览 —— 停止公网隧道（结束 cloudflared 进程）
Option Explicit
Dim sh, fso, baseDir, f, ts, content, msg
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
f = baseDir & "\_kill.tmp"
If fso.FileExists(f) Then fso.DeleteFile f

sh.Run "cmd /c taskkill /f /im cloudflared.exe > """ & f & """ 2>&1", 0, True

msg = "已发送停止命令。"
If fso.FileExists(f) Then
    On Error Resume Next
    Set ts = fso.OpenTextFile(f, 1)
    content = ts.ReadAll
    ts.Close
    fso.DeleteFile f
    On Error GoTo 0
    If Len(content) > 0 Then
        If InStr(content, "SUCCESS") > 0 Or InStr(content, "成功") > 0 Then
            msg = "隧道已停止。"
        ElseIf InStr(content, "没有") > 0 Or InStr(content, "No tasks") > 0 Or InStr(content, "not found") > 0 Then
            msg = "隧道未在运行（已停止）。"
        End If
    End If
End If
sh.Popup msg, 0, "灵山导览 公网隧道", 64
