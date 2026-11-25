'use strict';
// ข้อมูลเดโมของคลินิกปลูกผม (สุ่มแบบคงที่ ผลเหมือนเดิมทุกครั้งที่รัน)
const { today, addDays } = require('./dates');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pages = [
  { id: 'P1', name: 'Hairlab Clinic Bangkok' },
  { id: 'P2', name: "Hairlab Women's Hair" },
  { id: 'P3', name: 'Hairlab Phuket' },
];
const agencies = [
  { id: 'A1', name: 'In-house' },
  { id: 'A2', name: 'Growth Agency' },
  { id: 'A3', name: 'Pixel Studio' },
];
const reps = [
  { id: 'R1', name: 'นก' },
  { id: 'R2', name: 'มิ้นท์' },
  { id: 'R3', name: 'พลอย' },
  { id: 'R4', name: 'อาร์ม' },
];
const campaigns = [
  { id: 'C1', name: 'FUE Hair Transplant', price: [80000, 180000], status: 'ACTIVE', objective: 'OUTCOME_ENGAGEMENT', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', dailyBudget: 5000, lifetimeBudget: null, startTime: '2026-05-01' },
  { id: 'C2', name: 'PRP & Hair Treatment', price: [12000, 40000], status: 'ACTIVE', objective: 'OUTCOME_ENGAGEMENT', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', dailyBudget: 3500, lifetimeBudget: null, startTime: '2026-05-10' },
  { id: 'C3', name: 'Free Hair Consult', price: [15000, 90000], status: 'ACTIVE', objective: 'OUTCOME_LEADS', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', dailyBudget: 2500, lifetimeBudget: null, startTime: '2026-06-01' },
  { id: 'C4', name: "Women's Hair Thinning", price: [15000, 60000], status: 'ACTIVE', objective: 'OUTCOME_ENGAGEMENT', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', dailyBudget: 3000, lifetimeBudget: null, startTime: '2026-06-15' },
  { id: 'C5', name: 'Beard & Eyebrow', price: [35000, 90000], status: 'ACTIVE', objective: 'OUTCOME_ENGAGEMENT', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP', dailyBudget: 2200, lifetimeBudget: null, startTime: '2026-07-01' },
  { id: 'C6', name: 'Retargeting 30D', price: [20000, 120000], status: 'ACTIVE', objective: 'OUTCOME_SALES', buyingType: 'AUCTION', bidStrategy: 'COST_CAP', dailyBudget: 2000, lifetimeBudget: 60000, startTime: '2026-07-20' },
];

const DEMO_AD_META = {
  1046: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1800,
    headline: 'ปลูกผมถาวร FUE รีวิวเคสจริง Before & After โดยแพทย์เฉพาะทาง',
    body: 'หมดกังวลปัญหาผมบาง หน้าผากกว้าง M-Shape ด้วยเทคนิค FUE เจ็บน้อย แผลเล็กมาก พักฟื้นไว การันตีรากผมขึ้นแน่นเป็นธรรมชาติ ตรวจสภาพรากผมด้วย AI Microscope ฟรี!',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย · อายุ 28–45 ปี · กรุงเทพฯ และปริมณฑล · สนใจ: ปลูกผม, คลินิกความงาม, ดูแลเส้นผม',
    placement: 'Facebook Reels, Instagram Reels, Facebook Feed',
  },
  1045: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1600,
    headline: 'ผลลัพธ์หลังปลูกผม FUE ครบ 12 เดือน ผมหนาแน่น เปลี่ยนลุคชัดเจน',
    body: 'เปรียบเทียบชัดๆ หลังปลูกผมครบ 1 ปี เส้นผมแข็งแรง เรียงตัวตามแนวผมธรรมชาติ จัดแต่งทรงได้ทุกสไตล์ ทักแชทประเมินกราฟต์กับคุณหมอฟรีวันนี้',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 25–55 ปี · Lookalike 1% ลูกค้าปลูกผมจริงทั่วประเทศ',
    placement: 'Facebook Feed, Instagram Feed, Reels',
  },
  1052: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1500,
    headline: 'โปรโมชัน PRP ฟื้นฟูรากผมเข้มข้น ลดทันที 50% เฉพาะเดือนนี้!',
    body: 'ผมร่วงเยอะ ผมบาง เห็นหนังศีรษะ ฟื้นฟูด้วยเกล็ดเลือดเข้มข้น PRP มาตรฐานทางการแพทย์ กระตุ้นรากผมเกิดใหม่โดยไม่ต้องผ่าตัด จองสิทธิ์ราคาพิเศษทางแชท',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 22–35 ปี · กรุงเทพฯ · สนใจ: ลดผมร่วง, เซรั่มบำรุงผม, PRP',
    placement: 'Facebook Feed, Instagram Feed, Marketplace',
  },
  1051: {
    status: 'ACTIVE',
    optimizationGoal: 'THRUPLAY',
    destinationType: 'MESSENGER',
    dailyBudget: 1300,
    headline: 'รีวิวทำ PRP 3 ครั้ง ลูกผมขึ้นใหม่ดกดำ รากผมแข็งแรงขึ้นชัดเจน',
    body: 'ดูชัดๆ ขั้นตอนทำ PRP บำรุงรากผมที่ BEQ Hair Wellness ไม่เจ็บ ไม่ต้องพักฟื้น ใช้เวลาเพียง 45 นาที เหมาะกับคนเริ่มผมบางระยะแรก',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 22–38 ปี · กรุงเทพฯ, นนทบุรี, ปทุมธานี · สนใจ: รักษาผมร่วง',
    placement: 'Facebook Reels, Instagram Reels, Stories',
  },
  1056: {
    status: 'ACTIVE',
    optimizationGoal: 'LEAD_GENERATION',
    destinationType: 'MESSENGER',
    dailyBudget: 1250,
    headline: 'รวมโปรแกรมดูแลเส้นผมครบวงจร ปรึกษาแพทย์เฉพาะทางฟรี ไม่มีค่าใช้จ่าย',
    body: 'ไม่แน่ใจว่าควรปลูกผม FUE, DHI หรือทำทรีตเมนต์ PRP? ส่งรูปประเมินเบื้องต้นกับทีมแพทย์ BEQ Clinic เพื่อวางแผนการรักษาที่เหมาะกับคุณที่สุด',
    cta: 'LEARN_MORE',
    targetingSummary: 'ชาย/หญิง · อายุ 25–50 ปี · ทั่วประเทศไทย · Broad Targeting',
    placement: 'Facebook Feed, Instagram Carousel, Messenger Inbox',
  },
  1050: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1200,
    headline: 'คุณหมออธิบายชัด! ปลูกผม FUE ต้องใช้กี่กราฟต์ คำนวณงบอย่างไรไม่บานปลาย',
    body: 'ไขข้อข้องใจเรื่องจำนวนกราฟต์และการออกแบบแนวไรผมให้รับกับรูปหน้า โดยทีมแพทย์ผู้เชี่ยวชาญด้านการปลูกผมประจำ BEQ Group',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย · อายุ 28–45 ปี · กรุงเทพฯ · สนใจ: ศัลยกรรมปลูกผม, สุขภาพผู้ชาย',
    placement: 'Facebook Video Feeds, Instagram Reels',
  },
  1044: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'INSTAGRAM_DIRECT',
    dailyBudget: 1150,
    headline: 'ความประทับใจจากคนไข้จริง หลังปลูกผมที่ BEQ Clinic ความมั่นใจกลับมา 100%',
    body: 'ขอบคุณรีวิวจากคุณลูกค้าที่ไว้วางใจให้ BEQ ดูแลปัญหาเส้นผม สิทธิพิเศษสำหรับผู้ที่เคยทักเพจ รับส่วนลดเพิ่ม 5,000 บาททันทีเมื่อจองคิวเดือนนี้',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'Custom Audience: ผู้ที่มีส่วนร่วมกับเพจและ IG ในรอบ 30 วัน',
    placement: 'Instagram Stories, Facebook Stories',
  },
  1049: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1100,
    headline: 'Story รีวิวปลูกผมวันแรกจนถึงครบ 6 เดือน ดูแลใกล้ชิดทุกขั้นตอน',
    body: 'ติดตามผลหลังปลูกผมทุกเดือน พร้อมชุดดูแลเส้นผมหลังทำครบเซ็ต ทักแชทรับตารางประเมินกราฟต์และโปรผ่อน 0% นาน 10 เดือน',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 26–50 ปี · Lookalike 2% High-Value Patients',
    placement: 'Facebook Stories, Instagram Stories, Reels',
  },
  1047: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 1000,
    headline: 'แก้ปัญหาผมบางกลางศีรษะในผู้หญิง ด้วยโปรแกรมฟื้นฟูรากผมเฉพาะบุคคล',
    body: 'ผู้หญิงผมบาง แสกกว้าง ผมร่วงหลังคลอดหรือจากฮอร์โมน ฟื้นฟูให้ผมกลับมาหนานุ่มดูสุขภาพดีโดยไม่ต้องโกนผม ปรึกษาผู้เชี่ยวชาญฟรี',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'หญิง · อายุ 30–55 ปี · กรุงเทพฯ และหัวเมืองใหญ่ · สนใจ: ความงาม, สุขภาพเส้นผมผู้หญิง',
    placement: 'Instagram Reels, Facebook Reels, Feed',
  },
  1048: {
    status: 'ACTIVE',
    optimizationGoal: 'LEAD_GENERATION',
    destinationType: 'MESSENGER',
    dailyBudget: 950,
    headline: 'ลงทะเบียนตรวจวิเคราะห์หนังศีรษะและรากผมด้วยกล้อง AI ฟรี! (มูลค่า 1,500.-)',
    body: 'รู้ทันสาเหตุผมร่วงก่อนสายเกินแก้ ตรวจความหนาแน่นของรากผมและสภาพหนังศีรษะแบบละเอียด พร้อมรับคำแนะนำจากแพทย์',
    cta: 'BOOK_NOW',
    targetingSummary: 'หญิง · อายุ 30–55 ปี · กรุงเทพฯ · สนใจ: คลินิกความงาม, สปาผม',
    placement: 'Facebook Feed, Instagram Feed',
  },
  1053: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 900,
    headline: 'ปลูกหนวด ปลูกเครา ปลูกจอน ทรงสวยเข้มตามสั่ง โดยแพทย์เฉพาะทาง',
    body: 'เปลี่ยนลุคให้ดูคมเข้ม มีสไตล์ ด้วยการปลูกหนวดเคราถาวรจากรากผมตัวเอง ขึ้นจริง ไม่หลุดร่วง เลือกทรงได้ตามต้องการ',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย · อายุ 25–40 ปี · กรุงเทพฯ · สนใจ: แฟชั่นผู้ชาย, ปลูกหนวดเครา',
    placement: 'Facebook Reels, Instagram Reels',
  },
  1054: {
    status: 'PAUSED',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 800,
    headline: 'ปลูกคิ้วถาวรเรียงเส้นธรรมชาติ มิติใหม่แห่งความมั่นใจ ไม่ต้องสักคิ้ว',
    body: 'คิ้วบาง คิ้วแหว่ง มีแผลเป็น แก้ไขด้วยการปลูกคิ้วถาวรเทคนิคคัดกราฟต์เดี่ยว เรียงเส้นตามแนวขนคิ้วจริง ดูเป็นธรรมชาติที่สุด',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 25–45 ปี · กรุงเทพฯ · สนใจ: ปลูกคิ้ว, เสริมความงาม',
    placement: 'Facebook Feed, Instagram Feed',
  },
  1055: {
    status: 'PAUSED',
    optimizationGoal: 'LEAD_GENERATION',
    destinationType: 'MESSENGER',
    dailyBudget: 800,
    headline: 'สาขาภูเก็ตเปิดให้บริการแล้ว! นัดปรึกษาแพทย์ปลูกผมฟรีวันนี้',
    body: 'ชาวภูเก็ตและภาคใต้ไม่ต้องบินไกลถึงกรุงเทพฯ สัมผัสมาตรฐานการปลูกผมและดูแลรากผมระดับพรีเมียมได้แล้วที่สาขาภูเก็ต',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 25–55 ปี · ภูเก็ต, พังงา, กระบี่, สุราษฎร์ธานี',
    placement: 'Facebook Feed, Instagram Feed',
  },
  1057: {
    status: 'ACTIVE',
    optimizationGoal: 'OFFSITE_CONVERSIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 700,
    headline: 'แพ็กเกจปลูกผม & ฟื้นฟูรากผมราคาพิเศษ ผ่อน 0% นานสูงสุด 10 เดือน',
    body: 'รวมแพ็กเกจยอดนิยมของ BEQ Clinic พร้อมของแถมชุดบำรุงหลังทำมูลค่ากว่า 12,000 บาท ทักแชทเพื่อล็อกโปรโมชันได้เลย',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'Custom Audience: ผู้เข้าชมเว็บไซต์และหน้าแพ็กเกจในรอบ 30 วัน',
    placement: 'Facebook Carousel, Instagram Carousel',
  },
  1058: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'INSTAGRAM_DIRECT',
    dailyBudget: 650,
    headline: 'Q&A ตอบทุกคำถามเรื่อง PRP ผมร่วงทำกี่ครั้งเห็นผล?',
    body: 'รวมคำถามยอดฮิตเกี่ยวกับการทำ PRP บำรุงรากผม เจ็บไหม ต้องทำบ่อยแค่ไหน ใครทำได้บ้าง ดูจบในคลิปเดียว',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย/หญิง · อายุ 22–35 ปี · ภูเก็ตและภาคใต้ · สนใจ: ลดผมร่วง',
    placement: 'Instagram Stories, Facebook Stories',
  },
  1059: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 600,
    headline: 'อัลบั้มรีวิวเคสผู้หญิงผมบาง กลับมาผมดกหนาอีกครั้งที่ BEQ',
    body: 'เลื่อนดูผลลัพธ์เคสจริงของผู้หญิงที่มีปัญหาผมบางตรงรอยแสกและกลางศีรษะ หลังรับการรักษาต่อเนื่อง 3–6 เดือน',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'หญิง · อายุ 30–55 ปี · กรุงเทพฯ · สนใจ: บำรุงผม, คลินิกความงาม',
    placement: 'Facebook Carousel, Instagram Carousel',
  },
  1060: {
    status: 'ACTIVE',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'MESSENGER',
    dailyBudget: 500,
    headline: 'ทำความรู้จักทีมแพทย์เฉพาะทางด้านเส้นผมและหนังศีรษะ BEQ Clinic',
    body: 'เบื้องหลังความสำเร็จกว่า 5,000 เคส คือความใส่ใจในทุกกราฟต์และการออกแบบแนวผมเฉพาะบุคคล นัดคิวปรึกษาคุณหมอได้ทุกสาขา',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'Custom Audience: Page Engagers 30D · สาขาภูเก็ตและกรุงเทพฯ',
    placement: 'Facebook Reels, Instagram Reels',
  },
  1061: {
    status: 'PAUSED',
    optimizationGoal: 'CONVERSATIONS',
    destinationType: 'INSTAGRAM_DIRECT',
    dailyBudget: 450,
    headline: 'รีวิวปลูกเคราเต็มทรง เปลี่ยนลุคหนุ่มตี๋ให้คมเข้มใน 4 เดือน',
    body: 'เคสจริงปลูกหนวดและเครา 1,200 กราฟต์ แนวเส้นขนเรียงตัวสวยเป็นธรรมชาติ โกนและเล็มแต่งทรงได้เหมือนเคราจริง 100%',
    cta: 'SEND_MESSAGE',
    targetingSummary: 'ชาย · อายุ 25–40 ปี · กรุงเทพฯ · สนใจ: ปลูกหนวดเครา, บุคลิกภาพชาย',
    placement: 'Instagram Stories, Facebook Stories',
  },
};

// [id, campaign, adset, ชื่อ ad, creative, page, agency, น้ำหนักงบ, คุณภาพแชท 0-1]
const adDefs = [
  [1046, 'C1', 'Men 28–45 Bangkok', 'FUE · Reels · Before & After', 'VIDEO', 'P1', 'A1', 1.75, 0.62],
  [1045, 'C1', 'Lookalike Buyers', 'FUE · Reels · Result 12 Months', 'VIDEO', 'P1', 'A2', 1.6, 0.12],
  [1052, 'C2', 'Early Hair Loss 22–35', 'PRP · Static · Offer 50%', 'IMAGE', 'P1', 'A2', 1.55, 0.5],
  [1051, 'C2', 'Early Hair Loss 22–35', 'PRP · Reels · Before & After', 'VIDEO', 'P1', 'A2', 1.3, 0.42],
  [1056, 'C3', 'Broad Thailand 25–50', 'Consult · Carousel · Treatments', 'CAROUSEL', 'P1', 'A3', 1.25, 0.3],
  [1050, 'C1', 'Men 28–45 Bangkok', 'FUE · Reels · Doctor Explains', 'VIDEO', 'P1', 'A1', 1.2, 0.38],
  [1044, 'C6', 'Page Engagers', 'Retarget · Story · Testimonial', 'STORY', 'P1', 'A1', 1.15, 0.45],
  [1049, 'C1', 'Lookalike Buyers', 'FUE · Story · Testimonial', 'STORY', 'P1', 'A1', 1.1, 0.58],
  [1047, 'C4', 'Women 30–55', 'Women · Reels · Thinning Care', 'VIDEO', 'P2', 'A3', 1.0, 0.4],
  [1048, 'C4', 'Women 30–55', 'Women · Static · Free Scalp Check', 'IMAGE', 'P2', 'A3', 0.95, 0.34],
  [1053, 'C5', 'Men 25–40', 'Beard · Reels · Transformation', 'VIDEO', 'P1', 'A2', 0.9, 0.46],
  [1054, 'C5', 'Men 25–40', 'Eyebrow · Static · Natural Look', 'IMAGE', 'P1', 'A2', 0.8, 0.28],
  [1055, 'C3', 'Broad Thailand 25–50', 'Consult · Static · Free Consult', 'IMAGE', 'P3', 'A2', 0.8, 0.25],
  [1057, 'C6', 'Website Visitors', 'Retarget · Carousel · Packages', 'CAROUSEL', 'P3', 'A1', 0.7, 0.52],
  [1058, 'C2', 'Early Hair Loss 22–35', 'PRP · Story · Q&A', 'STORY', 'P3', 'A3', 0.65, 0.36],
  [1059, 'C4', 'Women 30–55', 'Women · Carousel · Before & After', 'CAROUSEL', 'P2', 'A3', 0.6, 0.48],
  [1060, 'C6', 'Page Engagers', 'Retarget · Reels · Doctor Intro', 'VIDEO', 'P3', 'A1', 0.5, 0.4],
  [1061, 'C5', 'Men 25–40', 'Beard · Story · Testimonial', 'STORY', 'P1', 'A1', 0.45, 0.33],
];

const firstNames = ['สมชาย', 'วิชัย', 'ณัฐพล', 'ปวีณา', 'กิตติ', 'อรทัย', 'ธนากร', 'สุรศักดิ์', 'พิมพ์ชนก',
  'ภาณุ', 'ชลธิชา', 'รัฐพล', 'นภัสสร', 'อนุชา', 'มณีรัตน์', 'ธีรพงษ์', 'กมลชนก', 'วรเชษฐ์'];
const initials = ['ส', 'ว', 'ก', 'ธ', 'พ', 'ป', 'จ', 'ม', 'ร', 'อ'];
const dropReasons = ['ราคาสูงเกินไป', 'ไม่สะดวกเดินทาง', 'เปรียบเทียบคลินิกอื่น', 'ไม่ตอบกลับ', 'แค่สอบถามข้อมูล', 'ขอเวลาตัดสินใจ'];

const HISTORY_DAYS = 200; // เผื่อเทียบช่วงก่อนหน้า 90 วัน
// ความคืบหน้าของแชท -> คุณภาพแชทที่ใช้สรุปในตารางโฆษณา
const QUALITY = {
  converted: 'good',
  qualified: 'good',
  appointment: 'good',
  in_progress: 'good',
  intake: 'average',
  talked: 'average',
  new: 'average',
  very_poor: 'poor',
  no_reply: 'poor',
};
const poorReasons = dropReasons.filter((r) => r !== 'ไม่ตอบกลับ');
let cache = null;

function buildDemoThumb(id, name, creative, campId) {
  const palettes = {
    C1: ['#064e3b', '#059669', '#6ee7b7', 'FUE TRANSPLANT'],
    C2: ['#0f766e', '#14b8a6', '#99f6e4', 'PRP TREATMENT'],
    C3: ['#1e3a8a', '#2563eb', '#93c5fd', 'FREE CONSULT'],
    C4: ['#701a75', '#d946ef', '#f5d0fe', 'WOMEN HAIR CARE'],
    C5: ['#78350f', '#d97706', '#fde68a', 'BEARD & BROW'],
    C6: ['#312e81', '#6366f1', '#c7d2fe', 'RETARGET VIP'],
  };
  const [c1, c2, acc, badge] = palettes[campId] || palettes.C1;
  const isVid = creative === 'VIDEO' || creative === 'STORY';
  const parts = String(name || '').split('·').map((s) => s.trim());
  const title1 = (parts[0] || 'BEQ Clinic').replace(/[<>&"']/g, '');
  const title2 = (parts[2] || parts[1] || badge).replace(/[<>&"']/g, '');
  const playOverlay = isVid
    ? `<circle cx="160" cy="110" r="26" fill="rgba(0,0,0,0.55)" stroke="#ffffff" stroke-width="2"/><polygon points="154,99 154,121 173,110" fill="#ffffff"/>`
    : `<rect x="130" y="84" width="60" height="48" rx="8" fill="rgba(255,255,255,0.16)" stroke="${acc}" stroke-width="1.5"/><circle cx="148" cy="100" r="5" fill="${acc}"/><polyline points="134,124 152,108 166,120 176,112 186,124" fill="none" stroke="#ffffff" stroke-width="2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="320" height="220" rx="16" fill="url(#g)"/>
    <circle cx="275" cy="40" r="65" fill="rgba(255,255,255,0.07)"/>
    <circle cx="40" cy="190" r="80" fill="rgba(255,255,255,0.05)"/>
    <rect x="16" y="14" width="108" height="22" rx="11" fill="rgba(0,0,0,0.35)"/>
    <text x="70" y="29" text-anchor="middle" fill="${acc}" font-family="sans-serif" font-size="10" font-weight="700">${badge}</text>
    <rect x="242" y="14" width="62" height="22" rx="11" fill="rgba(255,255,255,0.18)"/>
    <text x="273" y="29" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="10" font-weight="700">${creative}</text>
    ${playOverlay}
    <text x="160" y="166" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="800">${title2}</text>
    <text x="160" y="188" text-anchor="middle" fill="${acc}" font-family="sans-serif" font-size="12" font-weight="600">BEQ Hair Wellness · ${title1}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function build() {
  const t = today();
  const rand = rng(20261109);
  const start = addDays(t, -(HISTORY_DAYS - 1));

  const campById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  const ads = adDefs.map((d) => {
    const numId = d[0];
    const id = `AD-${numId}`;
    const creative = d[4];
    const isVid = creative === 'VIDEO' || creative === 'STORY';
    const metaInfo = DEMO_AD_META[numId] || {};
    const cObj = campById[d[1]] || {};
    return {
      id,
      campaignId: d[1],
      campaignStatus: cObj.status || 'ACTIVE',
      objective: cObj.objective || 'OUTCOME_ENGAGEMENT',
      buyingType: cObj.buyingType || 'AUCTION',
      bidStrategy: cObj.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
      adsetId: `AS-${numId}`,
      adset: d[2],
      adsetStatus: metaInfo.status || 'ACTIVE',
      status: metaInfo.status || 'ACTIVE',
      optimizationGoal: metaInfo.optimizationGoal || 'CONVERSATIONS',
      billingEvent: 'IMPRESSIONS',
      destinationType: metaInfo.destinationType || 'MESSENGER',
      dailyBudget: metaInfo.dailyBudget || 1000,
      lifetimeBudget: cObj.lifetimeBudget || null,
      startTime: cObj.startTime || start,
      updatedTime: `${t}T09:30:00+07:00`,
      name: d[3],
      creative,
      pageId: d[5],
      agencyId: d[6],
      weight: d[7],
      quality: d[8],
      thumb: buildDemoThumb(id, d[3], creative, d[1]),
      videoUrl: isVid ? `demo-reel:${id}` : null,
      headline: metaInfo.headline || d[3],
      body: metaInfo.body || '',
      cta: metaInfo.cta || 'SEND_MESSAGE',
      linkUrl: 'https://m.me/beqhairwellness',
      targetingSummary: metaInfo.targetingSummary || d[2],
      placement: metaInfo.placement || 'Facebook & Instagram Feeds, Reels, Stories',
    };
  });

  const daily = [];
  for (const ad of ads) {
    const cpm = 145 + rand() * 30;
    const ctr = 0.017 + rand() * 0.005;
    const costMsg = 36 + rand() * 9;
    const conv = 0.07 + rand() * 0.04;
    const launch = ad.id === 'AD-1058' || ad.id === 'AD-1059' || ad.id === 'AD-1060' || ad.id === 'AD-1061'
      ? 60 + Math.floor(rand() * 40) : 0;
    const isVid = ad.creative === 'VIDEO' || ad.creative === 'STORY';
    const avgPkgPrice = ((campById[ad.campaignId] && campById[ad.campaignId].price) || [25000, 65000])[0];
    for (let i = 0; i < HISTORY_DAYS; i++) {
      if (i < launch) continue;
      const date = addDays(start, i);
      if (rand() < 0.04) continue; // วันที่ adหยุดรัน
      const age = (HISTORY_DAYS - 1 - i) / (HISTORY_DAYS - 1); // 1 = เก่าสุด
      const season = 1 + 0.18 * age; // งบลดลงเล็กน้อยในช่วงล่าสุด
      const weekend = [0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay()) ? 0.9 : 1.05;
      const spend = 300 * ad.weight * season * weekend * (0.8 + rand() * 0.4);
      const impressions = Math.round((spend / (cpm * (0.97 + rand() * 0.06))) * 1000);
      const reach = Math.round(impressions * (0.62 + rand() * 0.07));
      const clicks = Math.round(impressions * ctr * (0.92 + rand() * 0.16));
      const messages = Math.max(0, Math.round(spend / (costMsg * (0.9 + rand() * 0.2))));
      const purchases = Math.floor(messages * conv * (0.8 + rand() * 0.4) + rand());
      // ข้อมูลเชิงลึกเพิ่มเติม (คำนวณแบบ deterministic เพื่อไม่ให้กระทบลำดับ RNG ของชุดทดสอบ)
      const uniqueClicks = Math.max(0, Math.round(clicks * 0.86));
      const linkClicks = Math.max(0, Math.round(clicks * 0.74));
      const postEngagement = Math.round(clicks * 1.45 + messages * 1.2);
      const reactions = Math.round(postEngagement * 0.62);
      const comments = Math.round(messages * 0.42);
      const shares = Math.max(0, Math.round(reactions * 0.11));
      const saves = Math.max(0, Math.round(reactions * 0.08));
      const landingPageViews = Math.max(0, Math.round(linkClicks * 0.82));
      const videoPlays = isVid ? Math.round(impressions * 0.46) : 0;
      const videoThruPlays = isVid ? Math.round(videoPlays * 0.34) : 0;
      const videoP25 = isVid ? Math.round(videoPlays * 0.68) : 0;
      const videoP50 = isVid ? Math.round(videoPlays * 0.49) : 0;
      const videoP75 = isVid ? Math.round(videoPlays * 0.37) : 0;
      const videoP100 = isVid ? Math.round(videoPlays * 0.24) : 0;
      const metaLeads = messages;
      const purchaseValue = purchases * avgPkgPrice;
      daily.push({
        date,
        adId: ad.id,
        spend: Math.round(spend * 100) / 100,
        impressions,
        reach,
        clicks,
        uniqueClicks,
        linkClicks,
        messages,
        metaLeads,
        purchases,
        purchaseValue,
        postEngagement,
        reactions,
        comments,
        shares,
        saves,
        landingPageViews,
        videoPlays,
        videoThruPlays,
        videoP25,
        videoP50,
        videoP75,
        videoP100,
      });
    }
  }

  // ลีดจากแชทที่ทีมขายบันทึก
  const leads = [];
  const totalW = ads.reduce((s, a) => s + a.weight, 0);
  const camp = Object.fromEntries(campaigns.map((c) => [c.id, c]));
  for (let n = 1; n <= 330; n++) {
    let r = rand() * totalW;
    const ad = ads.find((a) => (r -= a.weight) <= 0) || ads[0];
    const date = addDays(t, -Math.floor(Math.pow(rand(), 1.1) * 100));
    const qr = rand();
    const tier = qr < ad.quality ? 'good' : qr < ad.quality + (1 - ad.quality) * 0.55 ? 'average' : 'poor';
    const weights = {
      good: { qualified: 38, in_progress: 32, talked: 18, very_poor: 4, no_reply: 8 },
      average: { qualified: 12, in_progress: 26, talked: 36, very_poor: 12, no_reply: 14 },
      poor: { qualified: 2, in_progress: 8, talked: 20, very_poor: 34, no_reply: 36 },
    }[tier];
    let pick = rand() * Object.values(weights).reduce((x, y) => x + y, 0);
    let status = Object.keys(weights).find((k) => (pick -= weights[k]) <= 0) || 'talked';
    if (date >= addDays(t, -1) && status !== 'no_reply') status = rand() < 0.5 ? 'in_progress' : 'talked';
    const cr = rand();
    const channel = cr < 0.52 ? 'Messenger' : cr < 0.82 ? 'LINE' : cr < 0.95 ? 'Instagram' : 'WhatsApp';
    const [lo, hi] = camp[ad.campaignId].price;
    const bought = status === 'qualified' && rand() < 0.45;
    leads.push({
      id: `L-${String(n).padStart(4, '0')}`,
      name: `คุณ${firstNames[Math.floor(rand() * firstNames.length)]} ${initials[Math.floor(rand() * initials.length)]}.`,
      adId: ad.id,
      channel,
      date, // วันที่เริ่มคุย
      repId: reps[Math.floor(rand() * reps.length)].id,
      quality: QUALITY[status],
      status,
      value: bought ? Math.round((lo + rand() * (hi - lo)) / 500) * 500 : 0,
      firstResponseMin: status === 'no_reply' ? null : Math.round(2 + rand() * rand() * 58),
      dropReason: status === 'very_poor' ? poorReasons[Math.floor(rand() * poorReasons.length)] : status === 'no_reply' ? 'ไม่ตอบกลับ' : null,
    });
  }
  leads.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    pages,
    agencies,
    reps,
    campaigns: campaigns.map(({ price, ...rest }) => rest),
    ads,
    daily,
    leads,
  };
}

function load() {
  const key = today();
  if (!cache || cache.key !== key) cache = { key, data: build() };
  return cache.data;
}


// ---------- ข้อความแชทตัวอย่าง (สร้างจากรหัสลีด ผลเหมือนเดิมทุกครั้ง) ----------
const OPENERS = {
  C1: ['สวัสดีครับ สนใจปลูกผมแบบ FUE ครับ', 'ผมเริ่มผมบางตรงหน้าผาก อยากทราบราคาปลูกผมครับ'],
  C2: ['สนใจโปร PRP ลด 50% ค่ะ ยังมีอยู่ไหมคะ', 'อยากทำ PRP ลดผมร่วงค่ะ ราคาเท่าไหร่คะ'],
  C3: ['ขอปรึกษาฟรีหน่อยครับ ผมบางมาหลายปีแล้ว', 'สนใจนัดปรึกษาแพทย์ฟรีค่ะ ต้องทำยังไงคะ'],
  C4: ['ผมบางช่วงกลางศีรษะค่ะ ปรึกษาได้ไหมคะ', 'อยากตรวจหนังศีรษะฟรีค่ะ ต้องทำยังไงคะ'],
  C5: ['สนใจปลูกหนวดเคราครับ ราคาเริ่มต้นเท่าไหร่', 'อยากปลูกคิ้วให้ดูเป็นธรรมชาติค่ะ ราคาเท่าไหร่คะ'],
  C6: ['เคยดูโฆษณาไว้ อยากสอบถามแพ็กเกจเพิ่มเติมครับ', 'สนใจแพ็กเกจที่เคยเห็นค่ะ ขอรายละเอียดหน่อยค่ะ'],
};
const IG_OPENERS = [
  'สวัสดีค่ะคุณหมอ สนใจเคสปลูกผมใน IG Story เมื่อวานค่ะ สอบถามโปรโมชั่นหน่อยค่ะ',
  'ทักทายจาก IG ค่ะ สนใจปรึกษาเรื่องแนวผมด้านหน้าบางค่ะ',
  'เห็นรีวิวใน Instagram สวยเป็นธรรมชาติมากค่ะ มีคิวประเมินไหมคะ',
  'สนใจโปรปลูกผมสำหรับผู้หญิงจากโพสต์ในไอจีค่ะ',
  'สวัสดีค่ะ สอบถามราคาปลูกผม FUE ส่งรูปให้ประเมินทาง DM ได้ไหมคะ',
  'ทักมาจาก Instagram Reel ค่ะ สนใจโปรแกรมฟื้นฟูรากผม PRP ค่ะ',
];
const LINE_OPENERS = [
  'สวัสดีค่ะ ทักมาจาก LINE Official Account สนใจปรึกษาเรื่องปลูกผมค่ะ',
  'ขอสอบถามโปรโมชั่นปลูกผมผ่านทาง LINE ค่ะ',
  'สนใจนัดตรวจสภาพหนังศีรษะผ่าน LINE ค่ะ',
];
const WA_OPENERS = [
  'Hello! I would like to inquire about hair restoration packages.',
  'สวัสดีค่ะ สนใจสอบถามข้อมูลปลูกผมผ่านทาง WhatsApp ค่ะ',
];
const POOR_REPLY = {
  'ราคาสูงเกินไป': (p) => `แพงไปหน่อยนะ${p} ขอคิดดูก่อน`,
  'ไม่สะดวกเดินทาง': (p) => `อยู่ต่างจังหวัด ไม่สะดวกเดินทางมาที่คลินิก${p}`,
  'เปรียบเทียบคลินิกอื่น': (p) => `ขอเปรียบเทียบกับที่อื่นก่อนนะ${p}`,
  'แค่สอบถามข้อมูล': (p) => `แค่ถามดูเฉยๆ ${p} ขอบคุณมาก${p}`,
  'ขอเวลาตัดสินใจ': (p) => `ขอเวลาตัดสินใจก่อนนะ${p}`,
};

function conversation(lead, data) {
  const rand = rng(Number(String(lead.id).replace(/\D/g, '')) * 7919 + 13);
  const ad = ((data && data.ads) || []).find((a) => a.id === lead.adId);
  const camp = campaigns.find((c) => c.id === (ad && ad.campaignId)) || campaigns[0];
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const tdy = today();
  const msgs = [];
  let day = 0; let cur = 9 * 60 + Math.floor(rand() * 10 * 60); let stopped = false;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const say = (from, text, gap) => {
    if (stopped) return;
    cur += gap;
    if (cur > 22 * 60) { day += 1; cur = 9 * 60 + Math.floor(rand() * 90); }
    const date = addDays(lead.date, day);
    if (date > tdy) { stopped = true; return; }
    msgs.push({ from, text, at: `${date} ${hhmm(cur)}` });
  };

  const plat = String(lead.platform || (lead.channel === 'Instagram' ? 'Instagram' : lead.channel === 'LINE' ? 'LINE' : lead.channel === 'WhatsApp' ? 'WhatsApp' : 'Facebook'));
  const pageTitle = lead.pageName || (plat === 'Instagram' ? 'dr.nay_hairtransplant' : 'Pavicon Hair Clinic');

  let opener;
  if (plat === 'Instagram') opener = pick(IG_OPENERS);
  else if (plat === 'LINE') opener = pick(LINE_OPENERS);
  else if (plat === 'WhatsApp') opener = pick(WA_OPENERS);
  else opener = pick(OPENERS[camp.id] || OPENERS.C3);

  const p = /ค่ะ|คะ/.test(opener) ? 'ค่ะ' : 'ครับ';
  const q = p === 'ค่ะ' ? 'คะ' : 'ครับ';
  const info = pick([`บริเวณหน้าผากกับกลางศีรษะ${p} เป็นมาประมาณ 3 ปี`, `ผมร่วงเยอะช่วงปีที่ผ่านมา${p} โดยเฉพาะด้านบน`, `เหม่งขึ้นมา 2 ปีแล้ว${p}`]);
  const price = `ราคาขึ้นอยู่กับการประเมินของแพทย์ เบื้องต้นเริ่มที่ประมาณ ${fmt(camp.price[0])} บาท และไม่เกิน ${fmt(camp.price[1])} บาท ค่ะ`;

  say('customer', opener, 0);

  // คำทักทายและข้อความแยกตามแพลตฟอร์มและเพจอย่างชัดเจน ไม่ปะปนกัน
  let greeting;
  if (plat === 'Instagram') {
    greeting = `สวัสดีค่ะคุณ ${lead.name} ขอบคุณที่ทัก Direct Message มาหาทาง ${pageTitle} นะคะ ยินดีดูแลค่ะ ไม่ทราบว่ากังวลบริเวณไหนเป็นพิเศษคะ ส่งรูปให้แพทย์ประเมินเบื้องต้นได้เลยนะคะ`;
  } else if (plat === 'LINE') {
    greeting = `สวัสดีค่ะคุณ ${lead.name} ขอบคุณที่ติดต่อผ่าน LINE Official ของ ${pageTitle} นะคะ ยินดีให้คำปรึกษาค่ะ ไม่ทราบว่าสนใจบริการด้านใดคะ`;
  } else if (plat === 'WhatsApp') {
    greeting = `สวัสดีค่ะคุณ ${lead.name} ขอบคุณที่ติดต่อ ${pageTitle} ผ่าน WhatsApp ค่ะ ยินดีให้ข้อมูลและนัดหมายแพทย์ค่ะ`;
  } else {
    greeting = `สวัสดีค่ะคุณ ${lead.name} ขอบคุณที่ติดต่อเพจ ${pageTitle} ค่ะ ไม่ทราบว่าสนใจบริเวณไหน และเป็นมานานเท่าไหร่แล้วคะ`;
  }
  say('staff', greeting, lead.firstResponseMin ?? 6);

  switch (lead.status) {
    case 'no_reply':
      if (plat === 'Instagram') {
        say('staff', `ขออนุญาตติดตามนะคะคุณ ${lead.name} ยังสนใจให้คุณหมอประเมินแนวผมให้ทาง DM ไหมคะ`, 700);
        say('staff', `ทาง ${pageTitle} มีนัดตรวจกับแพทย์ฟรีสัปดาห์นี้ค่ะ หากสะดวกทักกลับได้เลยนะคะ`, 1500);
      } else {
        say('staff', `ขออนุญาตติดตามนะคะคุณ ${lead.name} ยังสนใจให้ทีมงานประเมินเบื้องต้นให้ไหมคะ`, 700);
        say('staff', `ทางเพจ ${pageTitle} มีนัดตรวจกับแพทย์ฟรีสัปดาห์นี้ค่ะ หากสะดวกทักกลับได้เลยนะคะ`, 1500);
      }
      break;
    case 'very_poor':
      say('customer', info, 8);
      say('staff', price, 5);
      say('customer', (POOR_REPLY[lead.dropReason] || POOR_REPLY['ขอเวลาตัดสินใจ'])(p), 15);
      say('staff', 'ได้เลยค่ะ หากต้องการข้อมูลเพิ่มเติม ทักมาได้ตลอดนะคะ', 4);
      break;
    case 'talked':
      say('customer', info, 6);
      say('staff', price, 5);
      say('customer', `ใช้เวลาฟื้นตัวนานไหม${q}`, 12);
      say('staff', 'โดยทั่วไปกลับไปทำงานได้ภายใน 3-5 วันค่ะ ผลลัพธ์จะเห็นชัดขึ้นเรื่อยๆ ภายใน 6-12 เดือน', 6);
      say('customer', `โอเค${p} เดี๋ยวขอคิดดูแล้วทักกลับนะ${p}`, 10);
      say('staff', 'ได้เลยค่ะ ถ้าต้องการนัดตรวจกับแพทย์แจ้งได้เลยนะคะ', 3);
      break;
    case 'in_progress':
      say('customer', info, 6);
      say('staff', price, 5);
      say('customer', `ขอนัดปรึกษากับหมอได้ไหม${q}`, 9);
      say('staff', 'ได้ค่ะ ตอนนี้ว่างวันพฤหัสกับวันเสาร์ สะดวกวันไหนคะ', 4);
      say('customer', `ขอดูตารางช่วงบ่ายก่อนนะ${p}`, 11);
      say('staff', plat === 'Instagram' ? 'ได้ค่ะ เดี๋ยวส่งตารางเวลาให้ทาง DM นะคะ รอยืนยันวันที่สะดวกอีกครั้งค่ะ' : 'ได้ค่ะ เดี๋ยวส่งตารางเวลาให้ทางแชทนะคะ รอยืนยันวันที่สะดวกอีกครั้งค่ะ', 5);
      break;
    case 'qualified': {
      say('customer', info, 6);
      say('staff', price, 5);
      say('customer', `งบประมาณประมาณ ${fmt(Math.round((camp.price[0] + (camp.price[1] - camp.price[0]) * 0.4) / 5000) * 5000)} บาท${p} อยากเริ่มเร็วที่สุด`, 8);
      say('staff', 'ตรงตามเงื่อนไขค่ะ ขอนัดตรวจกับแพทย์ก่อนเพื่อประเมินจำนวนที่เหมาะสม ว่างวันพฤหัสกับวันเสาร์ค่ะ', 5);
      say('customer', `วันเสาร์บ่ายสองได้${p}`, 7);
      say('staff', plat === 'Instagram' ? `ยืนยันนัดเรียบร้อยค่ะ เดี๋ยวส่งแผนที่และการเตรียมตัวให้ทาง DM นะคะ` : `ยืนยันนัดเรียบร้อยค่ะ เดี๋ยวส่งแผนที่และขั้นตอนก่อนเข้าพบให้ทางแชทนะคะ`, 3);
      if (lead.value > 0) {
        say('staff', `เพื่อจองคิวแพทย์ รบกวนชำระมัดจำ 5,000 บาทค่ะ ยอดรวมโปรแกรมประมาณ ${fmt(lead.value)} บาท`, 1500);
        say('customer', plat === 'Instagram' ? `โอนแล้ว${p} [ส่งสลิปทาง DM]` : `โอนแล้ว${p} [ส่งสลิป]`, 25);
        say('staff', 'ได้รับยอดมัดจำเรียบร้อยแล้วค่ะ ขอบคุณมากค่ะ แล้วพบกันนะคะ', 6);
      }
      break;
    }
    default:
  }
  return msgs;
}

module.exports = { load, conversation };
