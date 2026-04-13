import streamlit as st
import pandas as pd
import sqlite3
import plotly.express as px
import plotly.graph_objects as go

DB_PATH = "evaluation.db"

def load_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM evaluations ORDER BY created_at DESC", conn)
    conn.close()

    print("📊 Loaded rows:", len(df))   # 👈 ADD THIS

    return df

def render_dashboard():

    st.title("🚀 AI Performance Dashboard")

    df = load_data()

    if df.empty:
        st.warning("No evaluation data available.")
        return
    
    

    # ================= KPIs =================
    df = df[df["accuracy"] > 0]  # REMOVE garbage rows
    avg_acc = df["accuracy"].mean() if not df.empty else 0
    avg_prec = df["precision"].mean() if not df.empty else 0
    avg_rec = df["recall"].mean() if not df.empty else 0

    col1, col2, col3, col4 = st.columns(4)

    col1.metric("Accuracy", round(avg_acc, 2))
    col2.metric("Relevance", round(avg_prec, 2))
    col3.metric("Grounding", round(avg_rec, 2))
    col4.metric("Total Queries", len(df))

    # ================= HEALTH =================

    score = (avg_acc + avg_prec + avg_rec) / 3 * 100

    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score,
        title={"text": "AI System Health"},
        gauge={
            "axis": {"range": [0, 100]},
            "steps": [
                {"range": [0, 50], "color": "#8B0000"},
                {"range": [50, 70], "color": "#FFA500"},
                {"range": [70, 85], "color": "#87CEEB"},
                {"range": [85, 100], "color": "#2ECC71"},
            ],
        },
    ))

    st.plotly_chart(fig, use_container_width=True)

    # ================= VERDICT =================

    st.subheader("🧠 AI Verdict Distribution")

    fig = px.histogram(df, x="verdict", color="verdict")
    st.plotly_chart(fig, use_container_width=True)

    # ================= TREND =================

    st.subheader("📈 Accuracy Trend")

    df["time"] = pd.to_datetime(df["created_at"])

    trend = df.groupby(pd.Grouper(key="time", freq="10min"))["accuracy"].mean().reset_index()

    fig = px.line(trend, x="time", y="accuracy")
    st.plotly_chart(fig, use_container_width=True)

    # ================= FAILURE =================

    st.subheader("⚠️ Failure Analysis")

    fail_df = df[df["accuracy"] < 0.6]

    st.dataframe(
        fail_df[["question","answer","reason"]],
        use_container_width=True
    )

    # ================= TOP QUERIES =================

    st.subheader("🔥 Top Queries")

    top_q = df["question"].value_counts().head(10).reset_index()
    top_q.columns = ["Question","Count"]

    st.dataframe(top_q)

    # ================= FULL TABLE =================

    st.subheader("📊 Full Data")

    st.dataframe(df, use_container_width=True)
    st.divider()
st.subheader("📄 AI Executive Report")

if st.button("Generate Report"):

    total = len(df)
    avg_acc = round(df["accuracy"].mean(), 2)
    avg_prec = round(df["precision"].mean(), 2)
    avg_rec = round(df["recall"].mean(), 2)

    best = df.sort_values("accuracy", ascending=False).head(3)
    worst = df.sort_values("accuracy").head(3)

    report = f"""
==============================
 AI PERFORMANCE REPORT
==============================

📊 OVERVIEW
Total Queries: {total}

📈 METRICS
Accuracy   : {avg_acc}
Relevance  : {avg_prec}
Grounding  : {avg_rec}

🔥 TOP PERFORMING QUERIES
{best[['question','accuracy']].to_string(index=False)}

⚠️ WORST PERFORMING QUERIES
{worst[['question','accuracy','reason']].to_string(index=False)}

🧠 INSIGHTS
- High accuracy queries indicate good SOP retrieval
- Low accuracy indicates missing or weak context
- Relevance drop means question understanding issue

🚀 RECOMMENDATIONS
- Improve SOP indexing
- Add more structured SOP content
- Enhance retrieval logic

==============================
"""

    st.code(report)

    st.download_button(
        "⬇️ Download Report",
        report,
        "ai_report.txt"
    )