const BASE_URL = 'http://localhost:3000/api'

export async function request<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    data?: any
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const { method = 'GET', data, headers = {} } = options
  
  const fullUrl = BASE_URL + url
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  }

  const token = uni.getStorageSync('token')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: defaultHeaders,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data as T)
        } else {
          reject(new Error(res.data?.message || 'Request failed'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

export const get = <T = any>(url: string, params?: any) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<T>(url + query)
}

export const post = <T = any>(url: string, data?: any) => {
  return request<T>(url, { method: 'POST', data })
}

export const put = <T = any>(url: string, data?: any) => {
  return request<T>(url, { method: 'PUT', data })
}

export const del = <T = any>(url: string) => {
  return request<T>(url, { method: 'DELETE' })
}
