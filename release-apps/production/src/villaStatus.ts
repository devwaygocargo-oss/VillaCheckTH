// Presentation only: never writes workflow state or history.
export function villaStatusBadge(villa: {status:string;document?:{data?:string};documentReviewStatus?:string;reviewRequest?:{startedAt?:string}}) {
 if(villa.status==='approved')return {label:'อนุมัติแล้ว',tone:'approved'};
 if(villa.status==='rejected')return {label:'ปฏิเสธการอนุมัติ',tone:'rejected'};
 if(villa.status==='changes'||!villa.document?.data)return {label:'กรุณาแนบเอกสาร',tone:'changes'};
 if(villa.documentReviewStatus==='IN_REVIEW'||villa.reviewRequest?.startedAt)return {label:'อยู่ระหว่างการพิจารณา',tone:'reviewing'};
 return {label:'รอตรวจสอบ',tone:'pending'};
}
