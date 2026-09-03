import pytest
from conftest import lead, patient, login
from nightingale.app import LeadSession, FunnelEvent

def test_guest_conversation_and_attribution_survive_refresh(app,client):
    l=lead(client,channel="instagram_ad_click")
    client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"My stomach hurts."})
    url=f"/r/{l['recovery_token']}"
    first=client.get(url); refreshed=client.get(url)
    assert first.status_code==200 and refreshed.status_code==200
    assert b"My stomach hurts." in refreshed.data
    with app.app_context():
        saved=app.extensions["sqlalchemy"].session.get(LeadSession,l["lead_id"])
        assert saved.source_channel=="instagram_ad_click"
        assert saved.campaign_id=="ivf_over40" and saved.creative=="story_a"
        assert FunnelEvent.query.filter_by(lead_session_id=saved.id,event_type="value_event").count()==1

def test_demo_url_redirects_to_stable_recovery_url(client):
    r=client.get("/demo/instagram_ad_click",follow_redirects=False)
    assert r.status_code==302 and "/r/" in r.headers["Location"]

def test_normal_follow_up_is_context_sensitive(client):
    l=lead(client)
    first=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"Hello, I have a stomachache."}).get_json()
    second=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"It started last week."}).get_json()
    assert first["response"]!=second["response"]
    assert "When did it start?" in first["response"]
    assert "last week" in second["response"] and second["response"].count("?")==1

@pytest.mark.parametrize("phrase",[
    "I have crushing chest pain.",
    "I have difficulty breathing.",
    "I have heavy bleeding.",
    "I want to hurt myself.",
])
def test_emergency_guidance_appears_before_auth_without_waiting_language(client,phrase):
    l=lead(client)
    d=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":phrase}).get_json()
    assert d["risk"]["risk_level"]=="high" and d["next_action"]=="call_999"
    assert "dial 999" in d["response"] and "Do not wait" in d["response"]
    assert d["trust_transition"] is None
    assert "12" not in d["response"] and "signup" not in d["response"].lower()

def test_emergency_action_survives_guest_refresh(client):
    l=lead(client)
    client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"I have crushing chest pain."})
    page=client.get(f"/r/{l['recovery_token']}")
    assert b"Call 999 now" in page.data and b"Signup can wait" in page.data

def test_ambiguous_guest_message_requests_human_review(client):
    l=lead(client); d=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"my chest feels funny"}).get_json()
    assert d["risk"]["risk_level"]=="medium" and d["next_action"]=="clinic_review"
    assert "human should review" in d["response"].lower()

def test_high_risk_after_conversion_is_not_a_warm_lead(app):
    patient_client=app.test_client(); l,p,_=patient(patient_client)
    patient_client.post(f"/api/patient/{p['patient_session_id']}/messages",json={"content":"I have crushing chest pain."})
    staff=app.test_client(); login(staff,"clinician@demo.test")
    page=staff.get("/clinic")
    assert page.status_code==200
    # The acquisition channel may appear in funnel metrics, but its lead concern must not appear in warm-lead cards.
    assert b"No eligible warm leads" in page.data

def test_high_escalation_confirmation_and_queue_have_no_routine_wait_promise(app):
    c=app.test_client(); _,p,_=patient(c); ps=p["patient_session_id"]
    msg=c.post(f"/api/patient/{ps}/messages",json={"content":"I want to hurt myself"}).get_json()
    handoff=c.post(f"/api/patient/{ps}/escalate",json={"trigger_message_id":msg["message_id"]}).get_json()
    assert "Do not wait" in handoff["confirmation"] and "12" not in handoff["confirmation"]
    staff=app.test_client(); login(staff,"clinician@demo.test"); page=staff.get("/clinic")
    assert b"URGENT" in page.data and b"12\xe2\x80\x9318" not in page.data and b"12-18" not in page.data
