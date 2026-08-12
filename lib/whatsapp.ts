export const cleanPhone = (phone: string | null | undefined): string => {
  if (!phone) return ''
  return phone.replace(/[\+\s\-\(\)]/g, '')
}

export const getWaUrl = (phone: string | null | undefined, empresa: string): string => {
  const cleaned = cleanPhone(phone)
  if (!cleaned) return '#'
  const encodedEmpresa = encodeURIComponent(empresa)
  return `https://wa.me/${cleaned}?text=Hola%2C%20hablo%20con%20${encodedEmpresa}%3F`
}
