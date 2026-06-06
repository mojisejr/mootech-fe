import axios, { Method } from 'axios'

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
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    'x-api-key': token,
  }

  if (path_params !== null) {
    url = getPathQuery(url, path_params)
  }

  let axiosPromise

  if (method === 'POST' || method === 'PUT') {
    axiosPromise = axios({
      method,
      url,
      headers,
      data: body,
    })
  } else {
    const getUrl = url + getParamsQuery(body)

    axiosPromise = axios({
      method,
      url: getUrl,
      headers,
    })
  }
  return axiosPromise
    .then((response) => response?.data)
    .catch((error) => {
      return error?.response?.data
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

export { callApi, callApiUpload, exportFileExcel, exportFileZip }
