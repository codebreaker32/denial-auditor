import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../constants";
import { SANS } from "../fonts";
import { Card, Headline, Top, useEnter } from "../components";

const ROWS: [string, string, string][] = [
  ["Recommendation", "30 / 30", "16 / 29"],
  ["Hand-labeled rule statuses", "138 / 138", "119 / 131"],
  ["Mean cost per case", "$0.048", "$0.010"],
];

// Deck slide 8 as a scene: eval/results/final_super_scan.md and final_nano_scan.md.
export const Eval: React.FC = () => {
  const head = useEnter(2);
  const big = useEnter(10);
  const tab = useEnter(20);
  return (
    <AbsoluteFill style={{ background: COLORS.ground, fontFamily: SANS, color: COLORS.ink }}>
      <Top right="Evaluation · 30 synthetic cases" />
      <div style={head}><Headline text="Thirty synthetic denials, thirty right answers." size={84} /></div>
      <div style={{ position: "absolute", left: 72, right: 72, top: 400, display: "grid", gridTemplateColumns: "640px 1fr", gap: 18 }}>
        <div style={big}><Card bg={COLORS.yellow} style={{ height: 540, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 500, fontSize: 200, lineHeight: 0.9, letterSpacing: "-0.06em" }}>30/30</div>
          <p style={{ margin: 0, fontSize: 26, lineHeight: 1.35, color: "#3B2A00" }}>recommendations right with two Super samples per rule and an Ultra referee, about five cents a case</p>
        </Card></div>
        <div style={tab}><Card style={{ height: 540 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 28 }}>
            <thead><tr>{["", "Super ×2 + Ultra", "Nano, one sample"].map((t, i) => <th key={i} style={{ textAlign: i ? "right" : "left", fontSize: 20, fontWeight: 500, color: COLORS.faint, paddingBottom: 16 }}>{t}</th>)}</tr></thead>
            <tbody>{ROWS.map((r) => (
              <tr key={r[0]}>
                <td style={{ padding: "20px 0", borderTop: "1px solid #ECECEA" }}>{r[0]}</td>
                <td style={{ padding: "20px 0", borderTop: "1px solid #ECECEA", textAlign: "right", fontWeight: 500 }}>{r[1]}</td>
                <td style={{ padding: "20px 0", borderTop: "1px solid #ECECEA", textAlign: "right", color: COLORS.muted }}>{r[2]}</td>
              </tr>))}</tbody>
          </table>
          <p style={{ margin: "26px 0 0", fontSize: 21, lineHeight: 1.45, color: COLORS.faint }}>Our own cases and answer key; prompts were tuned on them. This shows the pipeline behaves as designed, not accuracy on real charts.</p>
        </Card></div>
      </div>
    </AbsoluteFill>
  );
};
