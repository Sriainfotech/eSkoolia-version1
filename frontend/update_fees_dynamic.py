import re

def update_fees_assignment():
    with open('components/fees/FeesAssignmentPanel.tsx', 'r', encoding='utf-8') as f:
        code = f.read()

    # Add useEffect to imports
    if 'useEffect' not in code:
        code = code.replace('import { useState, useMemo } from "react";', 'import { useState, useMemo, useEffect } from "react";\nimport { feesApi, listData } from "@/lib/fees-api";')

    # Remove the hardcoded mock students, ANNUAL_FEE, FEE_SCHEDULES, CONCESSIONS, PAYMENT_PLANS
    code = re.sub(r'const ANNUAL_FEE: Record<Category, number \| null> = \{.*?\};', '', code, flags=re.DOTALL)
    code = re.sub(r'const FEE_SCHEDULES: Record<string, FeeRow\[\]> = \{.*?\};', '', code, flags=re.DOTALL)
    code = re.sub(r'const CONCESSIONS\s*=\s*\[.*?\];', '', code, flags=re.DOTALL)
    code = re.sub(r'const PAYMENT_PLANS\s*=\s*\[.*?\];', '', code, flags=re.DOTALL)
    code = re.sub(r'const AVATAR_COLORS.*?const TOTAL_STUDENTS = CLASS_DATA.reduce\(\(s,c\)=>s\+c\.students\.length,0\);', '', code, flags=re.DOTALL)

    state_vars = """
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDynamicData = async () => {
    setLoading(true);
    try {
      const [stRes, clRes, asgnRes, grpRes, schRes] = await Promise.all([
        feesApi.listStudents(),
        feesApi.listClasses(),
        feesApi.listAssignments(),
        feesApi.listGroups(),
        feesApi.listSchedules()
      ]);
      setStudents(listData(stRes));
      setClasses(listData(clRes));
      setAssignments(listData(asgnRes));
      setGroups(listData(grpRes));
      setSchedules(listData(schRes));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicData();
  }, []);

  const PAYMENT_PLANS = [
    { id: "2-term",   label: "2-Term Plan",   desc: "Two equal instalments per year"     },
    { id: "3-term",   label: "3-Term Plan",   desc: "Three equal instalments per year"   },
    { id: "4-term",   label: "4-Term Plan",   desc: "Four equal instalments per year"    },
    { id: "monthly",  label: "Monthly Plan",  desc: "12 equal monthly payments"          },
    { id: "custom",   label: "Custom Plan",   desc: "Admin-defined irregular schedule"   },
  ];

  const FEE_SCHEDULES = useMemo(() => {
    const map: Record<string, FeeRow[]> = {};
    groups.forEach(g => {
      const gScheds = schedules.filter(s => s.fee_group === g.id);
      map[g.name] = gScheds.map(s => ({
        type: typeof s.fee_type === "object" && s.fee_type !== null ? s.fee_type.name : "Fee",
        schedule: s.collection_frequency || "Term-wise",
        howPaid: "From config",
        annual: parseFloat(s.amount || "0")
      }));
    });
    return map;
  }, [groups, schedules]);

  const ANNUAL_FEE = useMemo(() => {
    const map: Record<string, number | null> = { Unassigned: null };
    groups.forEach(g => {
      map[g.name] = (FEE_SCHEDULES[g.name] || []).reduce((s, r) => s + r.annual, 0);
    });
    return map;
  }, [FEE_SCHEDULES, groups]);

  const CONCESSIONS = ["None", "Staff Ward 50%", "Merit 25%", "Need-Based Full", "Sibling 10%"];

  const CLASS_DATA = useMemo(() => {
    const classMap = new Map<string, ClassSection>();
    classes.forEach(c => classMap.set(c.id.toString(), { id: c.id.toString(), name: c.name, students: [] }));
    
    students.forEach(st => {
      const clsId = st.current_class?.toString() || "unassigned";
      if (!classMap.has(clsId)) {
        classMap.set(clsId, { id: clsId, name: st.current_class_name || "Unassigned", students: [] });
      }
      
      const stAsgns = assignments.filter(a => a.student === st.id);
      const isAssigned = stAsgns.length > 0;
      let cat = "Unassigned";
      if (isAssigned) {
         const asgn = stAsgns[0];
         const sched = schedules.find(s => s.fee_type === asgn.fees_type || (s.fee_type && s.fee_type.id === asgn.fees_type));
         if (sched) {
            const grp = groups.find(g => g.id === sched.fee_group);
            if (grp) cat = grp.name;
         } else {
            cat = "Assigned";
         }
      }
      
      classMap.get(clsId)!.students.push({
        id: st.id.toString(),
        name: `${st.first_name || ""} ${st.last_name || ""}`.trim(),
        admNo: st.admission_no || `ID-${st.id}`,
        category: cat as any,
        planAgreed: isAssigned
      });
    });
    return Array.from(classMap.values()).filter(c => c.students.length > 0);
  }, [classes, students, assignments, groups, schedules]);

  const TOTAL_STUDENTS = CLASS_DATA.reduce((s, c) => s + c.students.length, 0);
"""

    if "const [students, setStudents]" not in code:
        code = code.replace("export default function FeesAssignmentPanel() {", "export default function FeesAssignmentPanel() {" + state_vars)

    helpers = """
const AVATAR_COLORS = ["#6D4AFF","#0E7490","#16a34a","#d97706","#dc2626","#7C3AED","#0284c7","#9333ea","#ca8a04","#059669"];
function avatarBg(name: string) { let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))>>>0; return AVATAR_COLORS[h%AVATAR_COLORS.length]; }
function initials(name: string) { const p=name.trim().split(" "); return (p[0][0]+(p[1]?.[0]??"")).toUpperCase(); }
function fmtRs(n: number)  { return "Rs. "+n.toLocaleString("en-IN"); }
function fmtInr(n: number) { return "₹"+n.toLocaleString("en-IN"); }
"""
    if "const AVATAR_COLORS" not in code:
        code = code.replace("// ── Style helpers ─", helpers + "\n// ── Style helpers ─")

    with open('components/fees/FeesAssignmentPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(code)


def update_fees_collection():
    with open('components/fees/FeesCollectionPanel.tsx', 'r', encoding='utf-8') as f:
        code = f.read()

    # Add useEffect to imports
    if 'useEffect' not in code:
        code = code.replace('import { useState, useMemo } from "react";', 'import { useState, useMemo, useEffect } from "react";\nimport { feesApi, listData } from "@/lib/fees-api";')

    # Remove the hardcoded mock students, INIT_PAYMENTS, RECONCILIATION
    code = re.sub(r'const STUDENTS: StudentRecord\[\] = \[.*?\];', '', code, flags=re.DOTALL)
    code = re.sub(r'const INIT_PAYMENTS: Payment\[\] = \[.*?\];', '', code, flags=re.DOTALL)
    code = re.sub(r'const RECONCILIATION = \[.*?\];', '', code, flags=re.DOTALL)
    
    state_vars = """
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDynamicData = async () => {
    setLoading(true);
    try {
      const [stRes, asgnRes, payRes, grpRes] = await Promise.all([
        feesApi.listStudents(),
        feesApi.listAssignments(),
        feesApi.listPayments(),
        feesApi.listGroups()
      ]);
      setStudentsData(listData(stRes));
      setAssignments(listData(asgnRes));
      setPaymentsList(listData(payRes));
      setGroups(listData(grpRes));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicData();
  }, []);

  const RECONCILIATION = [
    { id:"r1", ref:"HDFC statement UTR HDFC252705881",  match:"Matched to RCPT-25-4218 · Aditi Nair · Online",            score:98, status:"Matched"       },
    { id:"r2", ref:"Cheque CHQ842901 awaiting clearance",match:"Candidate: RCPT-25-4194 · Kabir Mehta · HDFC Bank",       score:72, status:"Review"         },
    { id:"r3", ref:"Wallet settlement batch PAYTM-7782", match:"6 receipts grouped · gateway fee difference Rs. 42",       score:91, status:"Matched"       },
    { id:"r4", ref:"Bank transfer UTR APS529801",        match:"No admission number in narration; possible ADM-0163",      score:64, status:"Needs mapping"  },
  ];

  const STUDENTS = useMemo(() => {
    return studentsData.map(st => {
      const stAsgns = assignments.filter(a => a.student === st.id);
      const stPays = paymentsList.filter(p => p.assignment && stAsgns.some(a => a.id === p.assignment));
      
      const ledger: LedgerEntry[] = [];
      let totalDue = 0;
      let totalPaid = 0;
      const dues: Due[] = [];
      
      stAsgns.forEach((a, i) => {
        const amt = parseFloat(a.amount || "0");
        totalDue += amt;
        ledger.push({ date: a.due_date || "2025-01-01", title: `Fee Assignment ${i+1}`, note: a.status, amount: amt, type: "charge" });
        if (a.status !== "paid") {
          dues.push({ id: a.id.toString(), label: `Fee Assignment ${i+1}`, amount: amt, due: a.due_date || "N/A" });
        }
      });
      
      stPays.forEach(p => {
        const pAmt = parseFloat(p.amount_paid || "0");
        totalPaid += pAmt;
        ledger.push({ date: p.payment_date || "2025-01-01", title: `Payment Received`, note: p.payment_method, amount: pAmt, type: "credit" });
      });
      
      let status: "partial" | "cleared" | "overdue" = "cleared";
      if (totalDue > totalPaid && totalPaid > 0) status = "partial";
      if (totalDue > totalPaid && totalPaid === 0) status = "overdue";

      return {
        id: st.id.toString(),
        name: `${st.first_name || ""} ${st.last_name || ""}`.trim(),
        admNo: st.admission_no || `ID-${st.id}`,
        cls: st.current_class_name || "N/A",
        group: "Assigned", // Simplified
        status: status,
        dues: dues,
        ledger: ledger,
        fullLedger: ledger,
        ledgerBalance: totalDue - totalPaid,
      };
    });
  }, [studentsData, assignments, paymentsList]);

  const INIT_PAYMENTS = useMemo(() => {
    return paymentsList.map((p, i) => ({
      rcpt: p.receipt_number || `RCPT-${i}`,
      student: studentsData.find(s => s.id === p.student)?.first_name || "Unknown",
      amount: parseFloat(p.amount_paid || "0"),
      method: p.payment_method || "Online"
    }));
  }, [paymentsList, studentsData]);
"""

    if "const [studentsData, setStudentsData]" not in code:
        code = code.replace("export default function FeesCollectionPanel() {", "export default function FeesCollectionPanel() {" + state_vars)

    with open('components/fees/FeesCollectionPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(code)


if __name__ == "__main__":
    update_fees_assignment()
    update_fees_collection()

