import {isDemoVilla} from './demo-villa-visibility.mjs';

export function dummyPropertyDetails(villa){
 if(!isDemoVilla(villa))return null;
 const capacity=villa.guest_capacity||12;
 return {isDemo:true,description:`${villa.name} ที่พักพูลวิลล่าสำหรับพักผ่อนกับครอบครัวและกลุ่มเพื่อนในจังหวัด${villa.province} มีพื้นที่ส่วนกลางสำหรับรับประทานอาหารและทำกิจกรรมร่วมกัน`,location:`จังหวัด${villa.province} · ข้อมูลสถานที่ DUMMY ไม่ใช่ที่อยู่สำหรับเดินทางจริง`,guestCapacity:capacity,bedrooms:Math.ceil(capacity/3),bathrooms:Math.ceil(capacity/4),amenities:['สระว่ายน้ำส่วนตัว','อินเทอร์เน็ต Wi-Fi','เครื่องปรับอากาศ','ห้องครัวและอุปกรณ์ทำอาหาร','พื้นที่ปิ้งย่าง','ที่จอดรถ','พื้นที่รับประทานอาหาร','โทรทัศน์'],checkIn:'14:00 น.',checkOut:'11:00 น.',rules:['เข้าพักไม่เกินจำนวนผู้เข้าพักที่ระบุ','งดสูบบุหรี่ภายในห้องพัก','ลดเสียงหลังเวลา 22:00 น.','ดูแลเด็กขณะใช้สระว่ายน้ำ'],notice:'ข้อมูล DUMMY สำหรับสาธิตรายละเอียดที่พัก ไม่เปิดรับจองและไม่รับโอนเงินจริง'};
}
