const isClear = (event: any) => {
  if (event.clipboardData?.getData('text') || typeof event.nativeEvent.data !== undefined) {
    return false
  }

  return true
}

export const regExStringCapital = (data: any) => {
  if (!/[A-Z]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

export const regExChassis = (data: any) => {
  if (!/[A-Za-z0-9]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExStringEngAndSymbol = (data: any) => {
  if (!/[.A-Z0-9@_]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExString = (data: any) => {
  if (!/[.A-Za-zก-ฮ-่-้-๊-๋-็ะ-ูเ-ไ-์ 0-9@_()]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

export const regExNumber = (data: any) => {
  if (!/[0-9.]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExDate = (data: any) => {
  if (!/[0-9\-/]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExUsername = (data: any) => {
  if (!/[.A-Za-z0-9@_]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}
const regExPassword = (data: any) => {
  if (!/[.A-Za-z0-9@_]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}
export const regExEmail = (data: any) => {
  if (!/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@thaivivat.co.th$/.test(data)) {
    return false
  }
  return true
}

const regExNumberOnly = (data: any) => {
  if (!/^[0-9]*$/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExPlateNumber = (data: any) => {
  if (!/(^[1-9]{0,1}$)|(^[1-9]{1}[0-9]{1,3}$)/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExPlateFront = (data: any) => {
  if (!/[0-9ก-ฮ]/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExPlateFull = (data: any) => {
  if (!/^[0-9ก-ฮ -]+$/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExRefNo = (data: any) => {
  if (!/(^[1]{0,1}$)|(^[1]{1}[0-9]{1,9}$)/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const regExTel = (data: any) => {
  if (!/(^[0]{0,1}$)|(^[0]{1}[0-9]{1,9}$)/.test(data) && data !== null && data !== undefined) {
    return false
  }
  return true
}

const isValidate = (event: any, setter: any, method: any) => {
  if (isClear(event)) {
    setter('')
  } else {
    if (!method(event.clipboardData?.getData('text') || event.nativeEvent.data) || undefined) {
      event.preventDefault()
    } else {
      //Set Value
      setter(event.target.value)
    }
  }
}

const isValidateFull = (event: any, setter: any, method: any) => {
  if (isClear(event)) {
    setter('')
  } else {
    if (!method(event.target.value)) {
      event.preventDefault()
    } else {
      //Set Value
      setter(event.target.value)
    }
  }
}

export const validateEmployeeCode = (event: any, setter: any) => {
  isValidate(event, setter, regExUsername)
}

export const validateTel = (event: any, setter: any) => {
  isValidateFull(event, setter, regExTel)
}
export const validateRefNumber = (event: any, setter: any) => {
  isValidateFull(event, setter, regExRefNo)
}

export const validatePassword = (event: any, setter: any) => {
  isValidate(event, setter, regExPassword)
}

export const validateEmail = (event: any, setter: any) => {
  isValidate(event, setter, regExEmail)
}

export const validatePostCode = (event: any, setter: any) => {
  isValidate(event, setter, regExNumberOnly)
}

export const validateId = (event: any, setter: any) => {
  isValidate(event, setter, regExStringEngAndSymbol)
}

export const validateAmount = (event: any, setter: any) => {
  isValidate(event, setter, regExNumber)
}

export const validatePlateNumber = (event: any, setter: any) => {
  isValidateFull(event, setter, regExPlateNumber)
}

export const validatePlateFont = (event: any, setter: any) => {
  isValidate(event, setter, regExPlateFront)
}

export const validatePlateFull = (event: any, setter: any) => {
  isValidate(event, setter, regExPlateFull)
}

export const validateNumberOnly = (event: any, setter: any) => {
  isValidate(event, setter, regExNumberOnly)
}


export const validateNumberOnlyFull = (event: any, setter: any) => {
  isValidateFull(event, setter, regExNumberOnly)
}


export const validateChassis = (event: any, setter: any) => {
  isValidate(event, setter, regExChassis)
}
