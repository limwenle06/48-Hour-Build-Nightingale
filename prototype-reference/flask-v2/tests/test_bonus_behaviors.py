from conftest import lead, patient, login

def test_channel_openings_differ(client):
    a=lead(client,"social_comment",platform="Instagram")["opening"]
    b=lead(client,"website_widget")["opening"]
    assert a!=b and "Instagram" in a

def test_session_recovery_and_staff_prefill(app):
    c=app.test_client(); login(c,"staff@demo.test")
    d=c.post("/api/staff/referrals",json={"context":"asked about egg freezing at today's visit"}).get_json()
    page=c.get(d["url"]); assert page.status_code==200 and b"asked about egg freezing" in page.data

def test_duplicate_escalation_is_idempotent(client):
    _,p,_=patient(client); ps=p["patient_session_id"]
    m=client.post(f"/api/patient/{ps}/messages",json={"content":"my chest feels funny"}).get_json()
    a=client.post(f"/api/patient/{ps}/escalate",json={"trigger_message_id":m["message_id"]}).get_json()
    b=client.post(f"/api/patient/{ps}/escalate",json={"trigger_message_id":m["message_id"]}).get_json()
    assert a["escalation_id"]==b["escalation_id"] and b["duplicate"] is True
