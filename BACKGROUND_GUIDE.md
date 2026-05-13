# Dynamic Background Guide: Popcat Chaos Edition 🐱💨

เอกสารนี้อธิบายถึงระบบการเปลี่ยนพื้นหลังแบบไดนามิกตาม **คะแนน (Score)** และ **ความเร็วในการคลิก (CPS)** เพื่อเพิ่มความตื่นเต้นและน่าค้นหาให้กับตัวเกม

## 🚀 แนวคิดพื้นฐาน (The Concept)
เราต้องการให้ผู้เล่นรู้สึกถึง "การพัฒนา" และ "ความท้าทาย" ที่เพิ่มขึ้น ยิ่งคลิกเยอะหรือคลิกเร็ว พื้นหลังจะยิ่งเปลี่ยนไปสู่มิติที่บ้าคลั่งมากขึ้น

---

## 📊 1. การเปลี่ยนตามคะแนน (Score-based Progression)
*เน้นความสำเร็จระยะยาว (Milestones)*

| ช่วงคะแนน | ธีมพื้นหลัง | คำอธิบายภาพ |
| :--- | :--- | :--- |
| 0 - 999 | **บ้านแสนสุข (Default)** | ห้องนั่งเล่นอุ่นๆ มีหน้าต่างเห็นสวนเขียวขจี |
| 1,000 - 4,999 | **ป่าอาถรรพ์** | ป่าทึบที่มีหมอกจางๆ และต้นไม้ที่ดูเหมือนขยับได้ |
| 5,000 - 9,999 | **เมืองไซเบอร์พังค์** | เมืองที่มีแสงนีออนสีชมพู-ฟ้า และฝนตกปรอยๆ |
| 10,000 - 49,999 | **มหาสมุทรลึก** | ใต้ทะเลลึกที่มีปลาเรืองแสง และฟองอากาศพุ่งขึ้นมา |
| 50,000+ | **วิหารแห่งเทพแมว** | วิหารสีทองบนก้อนเมฆ มีลำแสงศักดิ์สิทธิ์ส่องลงมา |

---

## ⚡ 2. การเปลี่ยนตามความเร็ว (CPS-based Intensity)
*เน้นความตื่นเต้นเฉพาะหน้า (Adrenaline)*

| CPS (คลิก/วินาที) | เอฟเฟกต์พิเศษ | สภาพแวดล้อม |
| :--- | :--- | :--- |
| 0 - 2 | **สงบนิ่ง** | พื้นหลังปกติ |
| 3 - 7 | **เริ่มสั่น** | พื้นหลังเริ่มมีการเบลอ (Motion Blur) เล็กน้อย |
| 8 - 12 | **พอร์ทัลเปิด** | มีเอฟเฟกต์วงแหวนเวทย์มนต์หรือรูหนอนปรากฏขึ้นซ้อนทับพื้นหลัง |
| 13 - 19 | **มิติบิดเบี้ยว** | พื้นหลังจะเริ่มหมุน (Rotate) และเปลี่ยนสีแบบสุ่ม (Hue-rotate) |
| 20+ | **GOD MODE** | พื้นหลังกลายเป็นสีขาวโพลนหรือรุ้ง Disco ที่กระพริบอย่างรวดเร็ว |

---

## 🎨 3. ไอเดียรูปภาพที่น่าค้นหา (Creative Image Ideas)

นี่คือไอเดียสำหรับภาพพื้นหลังที่ช่วยให้เกมดูมีสตอรี่:

1.  **"The Ancient Ruins"**: ซากปรักหักพังของวิหารแมวโบราณ มีรูปปั้น Popcat ขนาดมหึมาที่แตกร้าว
2.  **"Techno-Cat Core"**: ห้องเครื่องของยานอวกาศที่มีสายไฟและท่อก๊าซพุ่งออกมาตามจังหวะการคลิก
3.  **"Candy Land Chaos"**: โลกขนมหวานที่ดูน่ารักในตอนแรก แต่พอ CPS สูงขึ้น ขนมจะเริ่มระเบิดเป็นโกโก้คั้น
4.  **"Matrix Cat"**: ตัวเลขสีเขียวไหลลงมาเหมือนในหนัง Matrix แต่ถ้าสังเกตดีๆ จะเห็นเป็นรูปหน้าแมวซ่อนอยู่
5.  **"End of Time"**: ท้องฟ้าสีม่วงเข้มที่มีนาฬิกาทรายลอยอยู่ และนาฬิกาจะหมุนเร็วขึ้นตามคะแนน

---

## 🌈 4. ตัวอย่างพื้นหลังแบบ CSS-Only (ไม่ต้องใช้ไฟล์รูป)

หากคุณยังไม่มีไฟล์รูปภาพ สามารถใช้ CSS Patterns เหล่านี้ไปทดลองใช้ก่อนได้:

### 🪐 Deep Space (สำหรับคะแนนสูง)
```css
background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%);
background-image: 
    radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 40px),
    radial-gradient(white, rgba(255,255,255,.15) 1px, transparent 30px),
    radial-gradient(white, rgba(255,255,255,.1) 2px, transparent 40px);
background-size: 550px 550px, 350px 350px, 250px 250px;
```

### 🌋 Hell / Lava (สำหรับ CPS สูง)
```css
background: #2b0000;
background-image: 
    linear-gradient(0deg, transparent 50%, #ff4500 50%),
    linear-gradient(90deg, #8b0000 0%, #ff0000 100%);
background-size: 100% 10px, 100% 100%;
animation: lava-flow 1s infinite alternate linear;
```

### 💎 Crystal Dimension (มิติลึกลับ)
```css
background: #4a148c;
background-image: linear-gradient(135deg, #6a1b9a 25%, transparent 25%), 
                  linear-gradient(225deg, #6a1b9a 25%, transparent 25%), 
                  linear-gradient(45deg, #6a1b9a 25%, transparent 25%), 
                  linear-gradient(315deg, #6a1b9a 25%, transparent 25%);
background-position: 40px 0, 40px 0, 0 0, 0 0;
background-size: 80px 80px;
```

---

## 💻 5. ตัวอย่างการเขียน Code (Implementation)

คุณสามารถนำ Code นี้ไปปรับใช้ในไฟล์ `script.js` เพื่อรวมทั้ง Score และ CPS เข้าด้วยกัน:

```javascript
function updateDynamicBackground(count, cps) {
    const body = document.body;
    
    // 1. จัดการตามคะแนน (Long-term Theme)
    if (count > 50000) {
        body.style.backgroundImage = "url('god_temple.jpg')";
    } else if (count > 10000) {
        body.style.backgroundImage = "url('deep_sea.jpg')";
    } else if (count > 1000) {
        body.style.backgroundImage = "url('dark_forest.jpg')";
    }

    // 2. จัดการตามความเร็ว (Short-term Intensity)
    if (cps > 15) {
        body.style.filter = `hue-rotate(${Date.now() % 360}deg) blur(2px)`;
        body.classList.add('shake-extreme');
    } else if (cps > 8) {
        body.style.filter = "contrast(150%) brightness(120%)";
    } else {
        body.style.filter = "none";
    }
}
```

## 🛠️ ขั้นตอนต่อไป
- [ ] สร้างหรือค้นหารูปภาพตามธีมด้านบน
- [ ] เพิ่ม Class CSS สำหรับเอฟเฟกต์พิเศษ (เช่น `.shake-extreme`, `.motion-blur`)
- [ ] ทดสอบความลื่นไหลของการเปลี่ยนภาพ (แนะนำให้ใช้การ Transition เพื่อไม่ให้ภาพกระตุก)

---
*ขอให้สนุกกับการสร้างโลกของ Popcat! 🐾*
