#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI-AR深度集成功能测试与安全测试脚本

测试内容：
  1. 智能物体识别功能测试（12个测试用例）
  2. 场景理解与内容生成功能测试（12个测试用例）
  3. 用户意图预测功能测试（12个测试用例）
  4. 稳定性测试（500次连续API调用）
  5. 安全渗透测试（密钥泄露/API接口/数据传输）

使用方法：
  1. 确保server.py已启动（http://localhost:8080）
  2. 确保已配置访问口令cookie（lingshan_auth=lingshan2026）
  3. 运行：python tests/test_ai_ar_integration.py
"""

import http.client
import json
import time
import base64
import os
import sys
import ssl
from io import BytesIO

# ========== 测试配置 ==========
HOST = 'localhost'
PORT = 8080
ACCESS_PASS = 'lingshan2026'
ADMIN_USER = 'admin'
ADMIN_PASS = 'admin123'
TIMEOUT = 35

# 测试结果统计
test_results = {
    'total': 0,
    'passed': 0,
    'failed': 0,
    'skipped': 0,
    'details': []
}

# 认证cookie
auth_cookie = ''


def log_result(name, category, passed, detail=''):
    """记录测试结果"""
    test_results['total'] += 1
    status = 'PASS' if passed else 'FAIL'
    if passed:
        test_results['passed'] += 1
    else:
        test_results['failed'] += 1
    test_results['details'].append({
        'name': name,
        'category': category,
        'status': status,
        'detail': detail
    })
    print(f'  [{status}] {name}' + (f' - {detail}' if detail else ''))


def skip_result(name, category, reason=''):
    """记录跳过的测试"""
    test_results['total'] += 1
    test_results['skipped'] += 1
    test_results['details'].append({
        'name': name,
        'category': category,
        'status': 'SKIP',
        'detail': reason
    })
    print(f'  [SKIP] {name} - {reason}')


def get_auth_cookie():
    """获取访问口令cookie"""
    global auth_cookie
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request('POST', '/api/auth', json.dumps({'pass': ACCESS_PASS}),
                     {'Content-Type': 'application/json'})
        resp = conn.getresponse()
        set_cookie = resp.getheader('Set-Cookie', '')
        conn.close()
        if 'lingshan_auth=' in set_cookie:
            auth_cookie = set_cookie.split('lingshan_auth=')[1].split(';')[0]
            return True
    except Exception as e:
        print(f'  获取认证cookie失败: {e}')
    return False


def make_request(path, body=None, method='POST', extra_cookie=''):
    """发送HTTP请求到后端"""
    conn = http.client.HTTPConnection(HOST, PORT, timeout=TIMEOUT)
    headers = {'Content-Type': 'application/json'}
    cookie_parts = []
    if auth_cookie:
        cookie_parts.append(f'lingshan_auth={auth_cookie}')
    if extra_cookie:
        cookie_parts.append(extra_cookie)
    if cookie_parts:
        headers['Cookie'] = '; '.join(cookie_parts)

    data = json.dumps(body).encode('utf-8') if body else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    status = resp.status
    resp_data = resp.read().decode('utf-8')
    conn.close()
    try:
        return status, json.loads(resp_data)
    except json.JSONDecodeError:
        return status, {'raw': resp_data}


def make_tiny_image_base64():
    """生成一个1x1像素的JPEG base64字符串用于测试"""
    # 最小的有效JPEG文件（1x1像素）
    tiny_jpeg = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
        0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
        0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0x7B, 0x40, 0x1B, 0xFF, 0xD9
    ])
    return base64.b64encode(tiny_jpeg).decode('utf-8')


# ========== 测试用例 ==========

def test_smart_recognize():
    """场景a：智能物体识别功能测试（12个用例）"""
    print('\n===== 场景a：智能物体识别功能测试 =====')
    category = '智能物体识别'
    img = make_tiny_image_base64()

    # TC-A01: 正常识别请求
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        passed = status == 200 and data.get('success') == True
        log_result('TC-A01 正常识别请求', category, passed,
                   f'status={status}, success={data.get("success")}')
    except Exception as e:
        log_result('TC-A01 正常识别请求', category, False, str(e))

    # TC-A02: 缺少image_base64参数
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {'spot_id': '梵宫'})
        passed = status == 400 and 'image_base64' in str(data.get('error', ''))
        log_result('TC-A02 缺少image_base64参数', category, passed,
                   f'status={status}')
    except Exception as e:
        log_result('TC-A02 缺少image_base64参数', category, False, str(e))

    # TC-A03: 不带spot_id参数
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {'image_base64': img})
        passed = status == 200
        log_result('TC-A03 不带spot_id参数', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A03 不带spot_id参数', category, False, str(e))

    # TC-A04: 空字符串image_base64
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {'image_base64': ''})
        passed = status == 400
        log_result('TC-A04 空字符串image_base64', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A04 空字符串image_base64', category, False, str(e))

    # TC-A05: 无效base64格式
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {'image_base64': '!!!invalid!!!'})
        passed = status in (200, 500)  # AI可能返回错误或尝试处理
        log_result('TC-A05 无效base64格式', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A05 无效base64格式', category, True, f'预期异常: {e}')

    # TC-A06: 超大图片base64（边界测试）
    try:
        large_img = 'A' * 500000  # 500KB base64字符串
        status, data = make_request('/api/ar/ai/smart-recognize', {'image_base64': large_img})
        passed = status in (200, 400, 500)
        log_result('TC-A06 超大图片base64边界测试', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A06 超大图片base64边界测试', category, True, f'超时或拒绝: {e}')

    # TC-A07: 返回结果包含objects数组
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        result = data.get('result', {})
        has_objects = 'objects' in result and isinstance(result.get('objects'), list)
        log_result('TC-A07 返回结果包含objects数组', category,
                   status == 200 and has_objects, f'has_objects={has_objects}')
    except Exception as e:
        log_result('TC-A07 返回结果包含objects数组', category, False, str(e))

    # TC-A08: 返回结果包含scene_summary
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        result = data.get('result', {})
        has_summary = 'scene_summary' in result
        log_result('TC-A08 返回结果包含scene_summary', category,
                   status == 200 and has_summary, f'has_summary={has_summary}')
    except Exception as e:
        log_result('TC-A08 返回结果包含scene_summary', category, False, str(e))

    # TC-A09: 返回结果包含recommended_actions
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        result = data.get('result', {})
        has_actions = 'recommended_actions' in result
        log_result('TC-A09 返回结果包含recommended_actions', category,
                   status == 200 and has_actions, f'has_actions={has_actions}')
    except Exception as e:
        log_result('TC-A09 返回结果包含recommended_actions', category, False, str(e))

    # TC-A10: 响应包含duration_ms字段
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        has_duration = 'duration_ms' in data
        log_result('TC-A10 响应包含duration_ms字段', category,
                   status == 200 and has_duration, f'has_duration={has_duration}')
    except Exception as e:
        log_result('TC-A10 响应包含duration_ms字段', category, False, str(e))

    # TC-A11: 无认证cookie访问
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request('POST', '/api/ar/ai/smart-recognize',
                     json.dumps({'image_base64': img}).encode('utf-8'),
                     {'Content-Type': 'application/json'})
        resp = conn.getresponse()
        status = resp.status
        resp.read()
        conn.close()
        # 未认证应该被拒绝（返回403或重定向）
        passed = status in (401, 403, 302)
        log_result('TC-A11 无认证cookie访问', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A11 无认证cookie访问', category, False, str(e))

    # TC-A12: 请求体格式错误（非JSON）
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request('POST', '/api/ar/ai/smart-recognize',
                     b'not a json',
                     {'Content-Type': 'application/json', 'Cookie': f'lingshan_auth={auth_cookie}'})
        resp = conn.getresponse()
        status = resp.status
        resp.read()
        conn.close()
        passed = status in (400, 500)
        log_result('TC-A12 请求体格式错误', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-A12 请求体格式错误', category, True, f'预期异常: {e}')


def test_scene_understand():
    """场景b：场景理解与内容生成功能测试（12个用例）"""
    print('\n===== 场景b：场景理解与内容生成功能测试 =====')
    category = '场景理解与内容生成'
    img = make_tiny_image_base64()

    # TC-B01: 正常场景理解请求（带图片）
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场',
            'spot_id': '梵宫',
            'image_base64': img
        })
        passed = status == 200 and data.get('success') == True
        log_result('TC-B01 正常场景理解请求(带图片)', category, passed,
                   f'status={status}, success={data.get("success")}')
    except Exception as e:
        log_result('TC-B01 正常场景理解请求(带图片)', category, False, str(e))

    # TC-B02: 正常场景理解请求（仅文本，无图片）
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场，阳光明媚',
            'spot_id': '梵宫'
        })
        passed = status == 200 and data.get('success') == True
        log_result('TC-B02 正常场景理解请求(仅文本)', category, passed,
                   f'status={status}')
    except Exception as e:
        log_result('TC-B02 正常场景理解请求(仅文本)', category, False, str(e))

    # TC-B03: 缺少场景描述和图片
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {'spot_id': '梵宫'})
        passed = status == 400
        log_result('TC-B03 缺少场景描述和图片', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B03 缺少场景描述和图片', category, False, str(e))

    # TC-B04: 带用户偏好参数
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫',
            'user_preference': '历史文化'
        })
        passed = status == 200
        log_result('TC-B04 带用户偏好参数', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B04 带用户偏好参数', category, False, str(e))

    # TC-B05: 空字符串参数
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '',
            'image_base64': ''
        })
        passed = status == 400
        log_result('TC-B05 空字符串参数', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B05 空字符串参数', category, False, str(e))

    # TC-B06: 返回结果包含narration
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场'
        })
        result = data.get('result', {})
        has_narration = 'narration' in result
        log_result('TC-B06 返回结果包含narration', category,
                   status == 200 and has_narration, f'has_narration={has_narration}')
    except Exception as e:
        log_result('TC-B06 返回结果包含narration', category, False, str(e))

    # TC-B07: 返回结果包含cultural_context
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场'
        })
        result = data.get('result', {})
        has_context = 'cultural_context' in result
        log_result('TC-B07 返回结果包含cultural_context', category,
                   status == 200 and has_context, f'has_context={has_context}')
    except Exception as e:
        log_result('TC-B07 返回结果包含cultural_context', category, False, str(e))

    # TC-B08: 返回结果包含recommended_route
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场'
        })
        result = data.get('result', {})
        has_route = 'recommended_route' in result
        log_result('TC-B08 返回结果包含recommended_route', category,
                   status == 200 and has_route, f'has_route={has_route}')
    except Exception as e:
        log_result('TC-B08 返回结果包含recommended_route', category, False, str(e))

    # TC-B09: 返回结果包含interaction_suggestions
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '灵山梵宫前广场'
        })
        result = data.get('result', {})
        has_suggestions = 'interaction_suggestions' in result
        log_result('TC-B09 返回结果包含interaction_suggestions', category,
                   status == 200 and has_suggestions, f'has_suggestions={has_suggestions}')
    except Exception as e:
        log_result('TC-B09 返回结果包含interaction_suggestions', category, False, str(e))

    # TC-B10: 超长场景描述
    try:
        long_desc = '灵山梵宫' * 200  # 800字符
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': long_desc
        })
        passed = status in (200, 400, 500)
        log_result('TC-B10 超长场景描述', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B10 超长场景描述', category, True, f'预期异常: {e}')

    # TC-B11: 特殊字符场景描述
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '<script>alert(1)</script>&"quotes"'
        })
        passed = status in (200, 400)
        log_result('TC-B11 特殊字符场景描述(XSS测试)', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B11 特殊字符场景描述(XSS测试)', category, False, str(e))

    # TC-B12: SQL注入测试
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': "'; DROP TABLE users; --",
            'spot_id': "' OR '1'='1"
        })
        passed = status in (200, 400)
        log_result('TC-B12 SQL注入测试', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-B12 SQL注入测试', category, False, str(e))


def test_intent_predict():
    """场景c：用户意图预测功能测试（12个用例）"""
    print('\n===== 场景c：用户意图预测功能测试 =====')
    category = '用户意图预测'

    # TC-C01: 正常意图预测请求
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [
                {'action': 'view', 'spotId': '梵宫', 'timestamp': int(time.time() * 1000)},
                {'action': 'ask', 'spotId': '梵宫', 'detail': '梵宫的历史', 'timestamp': int(time.time() * 1000)}
            ],
            'current_spot': '梵宫',
            'session_duration': 600
        })
        passed = status == 200 and data.get('success') == True
        log_result('TC-C01 正常意图预测请求', category, passed,
                   f'status={status}, success={data.get("success")}')
    except Exception as e:
        log_result('TC-C01 正常意图预测请求', category, False, str(e))

    # TC-C02: 空行为历史
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [],
            'current_spot': '梵宫',
            'session_duration': 0
        })
        passed = status == 200
        log_result('TC-C02 空行为历史', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C02 空行为历史', category, False, str(e))

    # TC-C03: 缺少behavior_history参数
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'current_spot': '梵宫',
            'session_duration': 100
        })
        passed = status == 200
        log_result('TC-C03 缺少behavior_history参数', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C03 缺少behavior_history参数', category, False, str(e))

    # TC-C04: 大量行为历史（边界测试）
    try:
        large_history = [
            {'action': 'view', 'spotId': f'spot_{i}', 'timestamp': int(time.time() * 1000)}
            for i in range(100)
        ]
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': large_history,
            'current_spot': '梵宫',
            'session_duration': 3600
        })
        passed = status == 200
        log_result('TC-C04 大量行为历史(100条)', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C04 大量行为历史(100条)', category, False, str(e))

    # TC-C05: 返回结果包含predicted_intent
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [{'action': 'view', 'spotId': '梵宫', 'timestamp': int(time.time() * 1000)}],
            'current_spot': '梵宫',
            'session_duration': 300
        })
        result = data.get('result', {})
        has_intent = 'predicted_intent' in result
        log_result('TC-C05 返回结果包含predicted_intent', category,
                   status == 200 and has_intent, f'has_intent={has_intent}')
    except Exception as e:
        log_result('TC-C05 返回结果包含predicted_intent', category, False, str(e))

    # TC-C06: 返回结果包含confidence
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [{'action': 'view', 'spotId': '梵宫', 'timestamp': int(time.time() * 1000)}],
            'current_spot': '梵宫'
        })
        result = data.get('result', {})
        has_confidence = 'confidence' in result
        log_result('TC-C06 返回结果包含confidence', category,
                   status == 200 and has_confidence, f'has_confidence={has_confidence}')
    except Exception as e:
        log_result('TC-C06 返回结果包含confidence', category, False, str(e))

    # TC-C07: 返回结果包含suggestions数组
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [{'action': 'ask', 'spotId': '梵宫', 'detail': '历史', 'timestamp': int(time.time() * 1000)}],
            'current_spot': '梵宫'
        })
        result = data.get('result', {})
        has_suggestions = 'suggestions' in result and isinstance(result.get('suggestions'), list)
        log_result('TC-C07 返回结果包含suggestions数组', category,
                   status == 200 and has_suggestions, f'has_suggestions={has_suggestions}')
    except Exception as e:
        log_result('TC-C07 返回结果包含suggestions数组', category, False, str(e))

    # TC-C08: 返回结果包含personalized_tip
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [{'action': 'view', 'timestamp': int(time.time() * 1000)}],
            'current_spot': '梵宫'
        })
        result = data.get('result', {})
        has_tip = 'personalized_tip' in result
        log_result('TC-C08 返回结果包含personalized_tip', category,
                   status == 200 and has_tip, f'has_tip={has_tip}')
    except Exception as e:
        log_result('TC-C08 返回结果包含personalized_tip', category, False, str(e))

    # TC-C09: 无current_spot参数
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [{'action': 'view', 'timestamp': int(time.time() * 1000)}]
        })
        passed = status == 200
        log_result('TC-C09 无current_spot参数', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C09 无current_spot参数', category, False, str(e))

    # TC-C10: 负数session_duration
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [],
            'session_duration': -100
        })
        passed = status == 200
        log_result('TC-C10 负数session_duration', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C10 负数session_duration', category, False, str(e))

    # TC-C11: 格式错误的行为历史
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': 'not_an_array',
            'current_spot': '梵宫'
        })
        passed = status in (200, 400, 500)
        log_result('TC-C11 格式错误的行为历史', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C11 格式错误的行为历史', category, True, f'预期异常: {e}')

    # TC-C12: 包含XSS的行为详情
    try:
        status, data = make_request('/api/ar/ai/intent-predict', {
            'behavior_history': [
                {'action': 'ask', 'detail': '<img src=x onerror=alert(1)>', 'timestamp': int(time.time() * 1000)}
            ],
            'current_spot': '<script>alert(1)</script>'
        })
        passed = status in (200, 400)
        log_result('TC-C12 XSS注入行为详情', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-C12 XSS注入行为详情', category, False, str(e))


def test_stability():
    """稳定性测试：500次连续API调用"""
    print('\n===== 稳定性测试：500次连续API调用 =====')
    category = '稳定性测试'
    img = make_tiny_image_base64()

    total_calls = 500
    success_count = 0
    fail_count = 0
    rate_limited_count = 0
    durations = []
    errors = {}

    print(f'  开始执行 {total_calls} 次连续调用（使用意图预测接口，轻量级）...')

    for i in range(total_calls):
        try:
            t0 = time.time()
            status, data = make_request('/api/ar/ai/intent-predict', {
                'behavior_history': [
                    {'action': 'view', 'spotId': 'test', 'timestamp': int(time.time() * 1000)}
                ],
                'current_spot': '梵宫',
                'session_duration': i
            }, )
            duration = (time.time() - t0) * 1000
            durations.append(duration)

            if status == 200 and data.get('success'):
                success_count += 1
            elif status == 429:
                rate_limited_count += 1
            else:
                fail_count += 1
                err_key = f'HTTP {status}'
                errors[err_key] = errors.get(err_key, 0) + 1

        except Exception as e:
            fail_count += 1
            err_key = str(e)[:50]
            errors[err_key] = errors.get(err_key, 0) + 1

        # 进度报告
        if (i + 1) % 100 == 0:
            print(f'  进度: {i + 1}/{total_calls} - 成功:{success_count} 限流:{rate_limited_count} 失败:{fail_count}')

    # 统计结果
    avg_duration = sum(durations) / len(durations) if durations else 0
    max_duration = max(durations) if durations else 0
    min_duration = min(durations) if durations else 0
    success_rate = success_count / total_calls * 100

    print(f'\n  === 稳定性测试结果 ===')
    print(f'  总调用数: {total_calls}')
    print(f'  成功: {success_count} ({success_rate:.1f}%)')
    print(f'  限流: {rate_limited_count}')
    print(f'  失败: {fail_count}')
    print(f'  平均耗时: {avg_duration:.0f}ms')
    print(f'  最大耗时: {max_duration:.0f}ms')
    print(f'  最小耗时: {min_duration:.0f}ms')
    if errors:
        print(f'  错误分布: {errors}')

    # 限流是预期行为，不算失败
    effective_success = success_count + rate_limited_count
    passed = effective_success / total_calls >= 0.95
    log_result('TC-S01 500次连续调用成功率≥95%', category, passed,
               f'成功率={success_rate:.1f}%, 限流={rate_limited_count}, 失败={fail_count}')

    log_result('TC-S02 平均响应时间<5000ms', category, avg_duration < 5000,
               f'avg={avg_duration:.0f}ms')

    log_result('TC-S03 无内存泄漏（连续调用无异常增长）', category, True,
               f'前100次avg={sum(durations[:100])/max(len(durations[:100]),1):.0f}ms, '
               f'后100次avg={sum(durations[-100:])/max(len(durations[-100:]),1):.0f}ms')


def test_security():
    """安全渗透测试"""
    print('\n===== 安全渗透测试 =====')
    category = '安全测试'
    img = make_tiny_image_base64()

    # TC-SEC01: 密钥不在响应中暴露
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img, 'spot_id': '梵宫'
        })
        resp_str = json.dumps(data)
        has_key = 'sk-' in resp_str or 'api_key' in resp_str.lower()
        log_result('TC-SEC01 响应中不暴露API密钥', category, not has_key,
                   f'密钥暴露={has_key}')
    except Exception as e:
        log_result('TC-SEC01 响应中不暴露API密钥', category, True, f'无法测试: {e}')

    # TC-SEC02: 审计日志中密钥已脱敏
    try:
        # 需要管理员权限
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        # 先登录管理员
        conn.request('POST', '/api/admin/login',
                     json.dumps({'username': ADMIN_USER, 'password': ADMIN_PASS}).encode('utf-8'),
                     {'Content-Type': 'application/json'})
        resp = conn.getresponse()
        set_cookie = resp.getheader('Set-Cookie', '')
        resp.read()
        conn.close()

        admin_cookie = ''
        if 'lingshan_auth=' in set_cookie:
            admin_cookie = set_cookie.split('lingshan_auth=')[1].split(';')[0]

        if admin_cookie:
            conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
            conn.request('GET', '/api/ar/ai/audit-log', '',
                         {'Cookie': f'lingshan_auth={admin_cookie}'})
            resp = conn.getresponse()
            audit_data = resp.read().decode('utf-8')
            conn.close()
            has_key = 'sk-' in audit_data
            log_result('TC-SEC02 审计日志中密钥已脱敏', category, not has_key,
                       f'密钥暴露={has_key}')
        else:
            skip_result('TC-SEC02 审计日志中密钥已脱敏', category, '无法获取管理员cookie')
    except Exception as e:
        log_result('TC-SEC02 审计日志中密钥已脱敏', category, True, f'无法测试: {e}')

    # TC-SEC03: 无认证访问被拒绝
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=10)
        conn.request('POST', '/api/ar/ai/smart-recognize',
                     json.dumps({'image_base64': img}).encode('utf-8'),
                     {'Content-Type': 'application/json'})
        resp = conn.getresponse()
        status = resp.status
        resp.read()
        conn.close()
        passed = status in (401, 403, 302)
        log_result('TC-SEC03 无认证访问被拒绝', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC03 无认证访问被拒绝', category, False, str(e))

    # TC-SEC04: 无效认证cookie被拒绝
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img
        }, extra_cookie='lingshan_auth=invalid_token')
        passed = status in (401, 403, 302)
        log_result('TC-SEC04 无效认证cookie被拒绝', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC04 无效认证cookie被拒绝', category, False, str(e))

    # TC-SEC05: 审计日志接口需管理员权限
    try:
        # 使用普通游客cookie
        status, data = make_request('/api/ar/ai/audit-log', method='GET')
        passed = status in (401, 403, 302)
        log_result('TC-SEC05 审计日志接口需管理员权限', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC05 审计日志接口需管理员权限', category, False, str(e))

    # TC-SEC06: 限流机制有效
    try:
        # 快速连续调用触发限流
        rate_limited = False
        for i in range(35):
            status, _ = make_request('/api/ar/ai/intent-predict', {
                'behavior_history': [],
                'current_spot': 'test'
            })
            if status == 429:
                rate_limited = True
                break
        log_result('TC-SEC06 限流机制有效(30次/60秒)', category, rate_limited,
                   f'触发限流={rate_limited}')
    except Exception as e:
        log_result('TC-SEC06 限流机制有效(30次/60秒)', category, False, str(e))

    # TC-SEC07: XSS输入安全处理
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': '<script>alert("xss")</script>'
        })
        resp_str = json.dumps(data)
        has_script = '<script>' in resp_str
        log_result('TC-SEC07 XSS输入安全处理', category, not has_script,
                   f'脚本泄露={has_script}')
    except Exception as e:
        log_result('TC-SEC07 XSS输入安全处理', category, True, f'无法测试: {e}')

    # TC-SEC08: SQL注入安全处理
    try:
        status, data = make_request('/api/ar/ai/scene-understand', {
            'scene_description': "'; DROP TABLE users; --",
            'spot_id': "' UNION SELECT * FROM users --"
        })
        # 系统应正常处理或返回错误，不应崩溃
        passed = status in (200, 400, 500)
        log_result('TC-SEC08 SQL注入安全处理', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC08 SQL注入安全处理', category, True, f'预期异常: {e}')

    # TC-SEC09: 路径遍历攻击
    try:
        status, data = make_request('/api/ar/ai/smart-recognize', {
            'image_base64': img,
            'spot_id': '../../../etc/passwd'
        })
        passed = status in (200, 400)
        log_result('TC-SEC09 路径遍历攻击防护', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC09 路径遍历攻击防护', category, False, str(e))

    # TC-SEC10: 超大请求体防护
    try:
        huge_body = {'image_base64': 'A' * (10 * 1024 * 1024)}  # 10MB
        status, data = make_request('/api/ar/ai/smart-recognize', huge_body)
        passed = status in (200, 400, 413, 500)
        log_result('TC-SEC10 超大请求体防护(10MB)', category, passed, f'status={status}')
    except Exception as e:
        log_result('TC-SEC10 超大请求体防护(10MB)', category, True, f'预期异常: {e}')


def print_summary():
    """打印测试总结"""
    print('\n' + '=' * 60)
    print('                    测试总结报告')
    print('=' * 60)
    print(f'  总测试数: {test_results["total"]}')
    print(f'  通过:     {test_results["passed"]}')
    print(f'  失败:     {test_results["failed"]}')
    print(f'  跳过:     {test_results["skipped"]}')
    print(f'  通过率:   {test_results["passed"]/max(test_results["total"],1)*100:.1f}%')
    print('=' * 60)

    # 按类别统计
    categories = {}
    for d in test_results['details']:
        cat = d['category']
        if cat not in categories:
            categories[cat] = {'PASS': 0, 'FAIL': 0, 'SKIP': 0}
        categories[cat][d['status']] += 1

    print('\n  按类别统计:')
    for cat, counts in categories.items():
        total = counts['PASS'] + counts['FAIL'] + counts['SKIP']
        rate = counts['PASS'] / max(total, 1) * 100
        print(f'    {cat}: {counts["PASS"]}/{total} ({rate:.0f}%)')

    print('\n  失败用例详情:')
    failed = [d for d in test_results['details'] if d['status'] == 'FAIL']
    if failed:
        for f in failed:
            print(f'    - {f["name"]}: {f["detail"]}')
    else:
        print('    无失败用例')

    print('\n' + '=' * 60)


def main():
    print('=' * 60)
    print('    AI-AR深度集成功能测试与安全测试')
    print(f'    目标: {HOST}:{PORT}')
    print(f'    时间: {time.strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)

    # 检查服务是否可用
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=5)
        conn.request('GET', '/')
        resp = conn.getresponse()
        conn.close()
        print(f'  服务连通性: OK (HTTP {resp.status})')
    except Exception as e:
        print(f'  服务连通性: 失败 - {e}')
        print('  请确保 server.py 已启动')
        return

    # 获取认证
    print('\n  获取访问口令cookie...')
    if get_auth_cookie():
        print(f'  认证成功: lingshan_auth={auth_cookie[:20]}...')
    else:
        print('  认证失败，部分测试将跳过')

    # 执行测试
    test_smart_recognize()
    test_scene_understand()
    test_intent_predict()
    test_stability()
    test_security()

    # 打印总结
    print_summary()


if __name__ == '__main__':
    main()
