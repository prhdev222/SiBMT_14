/**
 * ค้นเคสเก่าที่คล้ายกับเคสที่กำลังจะตอบ
 *
 * ⚠️ ไม่ใช่ ML — เป็นการให้คะแนนด้วยกฎที่เขียนมือ น้ำหนักทุกตัวในไฟล์นี้
 * มาจากการคาดเดาของคนเขียน ไม่ได้เรียนรู้จากข้อมูล และไม่มีเฉลยให้วัดว่าถูกไหม
 *
 * ตั้งใจแยกเป็นไฟล์เดียวจบ เพื่อให้เปลี่ยนไปใช้ embedding + vector search
 * ได้ในอนาคตโดยไม่ต้องแตะหน้าจอเลย — ผู้เรียกรู้แค่ว่าได้ SimilarCase[] กลับมา
 * ไม่รู้ว่าคะแนนมาจากไหน (ดูบันทึกการตัดสินใจใน docs/DEPLOYMENT.md)
 *
 * เหตุผลที่ยังไม่ใช้ embedding ตอนนี้: ที่ข้อมูลหลักสิบถึงร้อยเคส
 * การจับคู่ด้วยกลุ่มโรคก็เจอเกือบหมดอยู่แล้ว embedding จะเปล่งประกาย
 * ตอนข้อมูลเยอะจนต้องคัดจริง ๆ และตอนนั้นจะมีข้อมูลให้ "วัด" ว่าอันไหนดีกว่า
 * แทนการเถียงกันว่าน่าจะดีกว่า
 */

import type { Referral } from "./referral-types";

export interface SimilarCase {
  referralId: string;
  submittedAt: string;
  diagnosis: string;
  stage: string;
  insuranceScheme: string;
  adviceRecord: string;
  adviceRegimens: string;
  /** เหตุผลที่จับคู่ — แสดงให้ผู้ตอบเห็นเสมอ ไม่ใช่กล่องดำ */
  reasons: string[];
}

/**
 * ต่ำกว่านี้ถือว่าไม่คล้ายพอจะเสียเวลาอ่าน
 *
 * ตั้งไว้เท่ากับ "กลุ่มโรคเดียวกัน" พอดี — เคสที่คนละกลุ่มโรคต้องมีคำซ้ำกันหลายคำ
 * ถึงจะผ่านเข้ามาได้ ไม่ใช่แค่บังเอิญพิมพ์คำว่า "relapsed" เหมือนกัน
 *
 * ผลที่ตามมาโดยตั้งใจ: เคสที่ตรงแค่กลุ่มโรคอย่างเดียวก็ผ่านเกณฑ์
 * ในช่วงแรกที่ยังมีข้อมูลน้อย การได้เห็นเคสกลุ่มโรคเดียวกันสักเคสยังดีกว่าไม่เห็นอะไร
 * และเพราะเรียงตามคะแนน เคสที่ตรงแค่กลุ่มโรคจะถูกดันลงล่างทันทีที่มีเคสที่ตรงกว่า
 * — บรรทัด "จับคู่จาก:" บอกตรง ๆ ว่าตรงแค่อะไร ผู้ตอบจึงตัดสินน้ำหนักเองได้
 */
const MIN_SCORE = 40;

const WEIGHT = {
  diseaseGroup: 40,
  insurance: 20,
  diagnosisWord: 12,
  questionWord: 6,
  stageWord: 5,
  /** คำไทยจับด้วย 3-gram ซึ่งซ้ำกันง่ายกว่าคำอังกฤษมาก จึงให้น้ำหนักต่ำและมีเพดาน */
  thaiGram: 1.5,
};

/** เพดานคะแนนต่อหมวด กันเคสที่ข้อความยาวมากชนะเพราะยาว ไม่ใช่เพราะคล้าย */
const CAP = { diagnosis: 36, question: 24, stage: 15, thai: 18 };

/** คำที่โผล่แทบทุกเคสจนไม่ได้บอกอะไร */
const STOPWORDS = new Set([
  "and", "the", "for", "with", "after", "post", "pre", "case", "patient",
  "year", "years", "old", "male", "female", "cycle", "cycles",
]);

/**
 * ตัดคำอังกฤษและตัวเลข
 *
 * ⚠️ ภาษาไทยเขียนติดกันไม่มีช่องว่าง ตัดแบบนี้จึงได้ก้อนเดียวทั้งประโยค
 * จึงต้องมี thaiGrams() คู่กัน — ดูคำอธิบายที่นั่น
 */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/**
 * ตัดข้อความไทยเป็นชุดตัวอักษร 3 ตัวซ้อนกัน
 *
 * ใช้แทนการตัดคำจริง เพราะการตัดคำไทยต้องมีพจนานุกรม ซึ่งเกินความจำเป็น
 * ของงานนี้ — 3-gram ให้ความคล้ายที่ใช้ได้พอสมควรโดยไม่ต้องพึ่งอะไรเพิ่ม
 *
 * จำเป็นขึ้นมากตั้งแต่กลุ่มที่ 2 เปิดรับคำถามทั่วไป ไม่ใช่แค่เรื่องสูตรยา
 * เพราะคำถามทั่วไปมักเขียนเป็นภาษาไทยล้วน ต่างจากการวินิจฉัยที่เป็นศัพท์อังกฤษ
 */
function thaiGrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const run of text.match(/[฀-๿]{6,}/g) ?? []) {
    for (let i = 0; i + 3 <= run.length; i++) out.add(run.slice(i, i + 3));
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const item of a) if (b.has(item)) n++;
  return n;
}

/**
 * เคสเก่าที่คล้ายที่สุด เรียงจากคล้ายมากไปน้อย
 *
 * นับเฉพาะเคสที่ "ตอบไปแล้ว" — เคสที่ยังไม่มีคำตอบไม่มีอะไรให้เรียนรู้
 * และไม่นับเคสตัวเอง
 */
export function findSimilarCases(
  target: Referral,
  pool: Referral[],
  limit = 3,
): SimilarCase[] {
  const targetDx = words(target.diagnosis);
  const targetQ = words(target.clinicalQuestion);
  const targetStage = words(target.stage);
  const targetThai = thaiGrams(
    `${target.diagnosis} ${target.clinicalQuestion} ${target.stage}`,
  );

  const scored = pool
    .filter(
      (r) =>
        r.referralId !== target.referralId && r.adviceRecord.trim().length > 0,
    )
    .map((r) => {
      const reasons: string[] = [];
      let score = 0;

      if (target.diseaseGroup && r.diseaseGroup === target.diseaseGroup) {
        score += WEIGHT.diseaseGroup;
        reasons.push("กลุ่มโรคเดียวกัน");
      }

      if (
        target.insuranceScheme &&
        r.insuranceScheme === target.insuranceScheme
      ) {
        score += WEIGHT.insurance;
        reasons.push("สิทธิเดียวกัน");
      }

      const dx = overlap(targetDx, words(r.diagnosis));
      if (dx > 0) {
        score += Math.min(dx * WEIGHT.diagnosisWord, CAP.diagnosis);
        reasons.push(`การวินิจฉัยตรงกัน ${dx} คำ`);
      }

      const q = overlap(targetQ, words(r.clinicalQuestion));
      if (q > 0) {
        score += Math.min(q * WEIGHT.questionWord, CAP.question);
        reasons.push(`คำถามตรงกัน ${q} คำ`);
      }

      const st = overlap(targetStage, words(r.stage));
      if (st > 0) score += Math.min(st * WEIGHT.stageWord, CAP.stage);

      const thai = overlap(
        targetThai,
        thaiGrams(`${r.diagnosis} ${r.clinicalQuestion} ${r.stage}`),
      );
      if (thai > 0) {
        score += Math.min(thai * WEIGHT.thaiGram, CAP.thai);
        // ไม่บอกจำนวน 3-gram ให้ผู้ใช้ดู เพราะเป็นตัวเลขที่ไม่มีความหมายกับคนอ่าน
        if (thai >= 6) reasons.push("ข้อความภาษาไทยคล้ายกัน");
      }

      return { referral: r, score, reasons };
    })
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ referral, reasons }) => ({
    referralId: referral.referralId,
    submittedAt: referral.submittedAt,
    diagnosis: referral.diagnosis,
    stage: referral.stage,
    insuranceScheme: referral.insuranceScheme,
    adviceRecord: referral.adviceRecord,
    adviceRegimens: referral.adviceRegimens,
    reasons,
  }));
}
