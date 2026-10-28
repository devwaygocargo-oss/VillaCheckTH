export function mediaDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    value > new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  )
    throw Object.assign(Error("วันที่ถ่ายต้องเป็นวันที่จริงและไม่อยู่ในอนาคต"), {
      status: 400,
    })
  return value
}
