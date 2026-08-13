import axios, { Method } from 'axios'

// Result shape for the status-aware path (callApiWithStatus). The legacy callApi below deliberately
// throws this away (returns bare data) so its call sites are UNCHANGED — this type is only for the new
// path that needs to tell 410 / 5xx / network apart (#263).
export type ApiResult<T = any> =
  | { ok: true; status: number; data: T }
  | { ok: false; kind: 'http'; status: number; data: any } // server responded with an error status
  | { ok: false; kind: 'network'; error: unknown } // no response at all (offline / timeout / CORS)

// Shared request construction for callApi + callApiWithStatus. Returns the raw axios promise so each
// caller applies its OWN success/error handling. Extracting this does NOT change callApi's behavior:
// callApi still resolves to response.data and swallows errors to error.response.data, exactly as before.
function buildAxiosRequest(
  url: string,
  method: Method,
  token: any,
  body: any,
  path_params: any,
) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    'x-api-key': token,
  }

  if (path_params !== null) {
    url = getPathQuery(url, path_params)
  }

  if (method === 'POST' || method === 'PUT') {
    return axios({ method, url, headers, data: body })
  }
  const getUrl = url + getParamsQuery(body)
  return axios({ method, url: getUrl, headers })
}

const getParamsQuery = (params: any = {}) => {
  if (Object.keys(params).length !== 0) {
    return Object.keys(params)
      .reduce((query, param) => `${query}${param}=${params[param]}&`, '?')
      .slice(0, -1)
  }

  return ''
}

const getPathQuery = (url: string, params: any = {}) => {
  if (Object.keys(params).length !== 0) {
    const objs = Object.keys(params)

    objs.forEach((item) => {
      url = url.replace(`:${item}`, params[item])
    })
  }

  return url
}

function callApi(url: string, method: Method, token: any, body = {}, path_params: any) {
  // UNCHANGED contract: resolves to response.data on success, error.response.data on failure. Every
  // existing call site (constants/api/api-*.ts) depends on this exact shape — do not alter it. New code
  // that needs the HTTP status must use callApiWithStatus instead (#263).
  return buildAxiosRequest(url, method, token, body, path_params)
    .then((response) => response?.data)
    .catch((error) => {
      return error?.response?.data
    })
}

// Status-aware sibling of callApi (#263). Same request, but the caller learns WHY it failed:
//   ok:true            → 2xx, carries data
//   ok:false http      → server replied with an error status (410 = quota gate, 5xx = server down…)
//   ok:false network   → no response object (offline / timeout / CORS) — can't blame the server
// Never throws (mirrors callApi's swallow-and-return style) so callers branch on the tag, not try/catch.
function callApiWithStatus<T = any>(
  url: string,
  method: Method,
  token: any,
  body: any = {},
  path_params: any = null,
): Promise<ApiResult<T>> {
  return buildAxiosRequest(url, method, token, body, path_params)
    .then((response) => ({ ok: true as const, status: response?.status, data: response?.data as T }))
    .catch((error) => {
      if (error?.response) {
        return { ok: false as const, kind: 'http' as const, status: error.response.status, data: error.response.data }
      }
      return { ok: false as const, kind: 'network' as const, error }
    })
}

function callApiUpload(url: string, method: Method, token: any, formData: any) {
  const requestOptions = {
    method: 'POST',
    body: formData,
  }

  return fetch(url, requestOptions)
    .then((response) => response.json())
    .then(
      (data) => data,
      (error) => {
        if (error) {
          return error
        }
      },
    )
}

function exportFileExcel(url: string, method: Method, body = {}, filename: string) {
  const getUrl = url + getParamsQuery(body)
  const axiosPromise = axios({
    responseType: 'blob',
    method,
    url: getUrl,
    data: body,
  })

  return axiosPromise
    .then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')

      link.href = url
      link.setAttribute('download', filename) //or any other extension
      document.body.appendChild(link)
      link.click()
    })
    .catch((error) => {
      throw error?.response?.data
    })
}

function exportFileZip(url: string, method: Method, body = {}, filename: string) {
  const getUrl = url + getParamsQuery(body)

  const axiosPromise = axios({
    responseType: 'blob',
    method,
    url: getUrl,
    data: body,
  })

  return axiosPromise
    .then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')

      link.href = url
      link.setAttribute('download', filename) //or any other extension
      document.body.appendChild(link)
      link.click()
    })
    .catch((error) => {
      throw error?.response?.data
    })
}

export { callApi, callApiWithStatus, callApiUpload, exportFileExcel, exportFileZip }
