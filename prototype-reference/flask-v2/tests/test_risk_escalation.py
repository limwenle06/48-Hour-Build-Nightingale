import pytest
from conftest import patient
from nightingale.app import assess_risk

@pytest.mark.parametrize("text",["I have crushing chest pain.","difficulty breathing","heavy bleeding","I want to hurt myself"])
def test_mandatory_high_risk_phrases(text):
    r=assess_risk(text); assert r["risk_level"]=="high" and r["escalation_required"] is True

def test_high_risk_stops_advice(client):
    _,p,_=patient(client); d=client.post(f"/api/patient/{p['patient_session_id']}/messages",json={"content":"I have crushing chest pain."}).get_json()
    assert d["risk"]["risk_level"]=="high" and d["risk"]["escalation_required"]
    assert "can’t safely assess" in d["response"] and "Send to Clinic" in d["response"]

def test_ambiguous_chest_message_escalates():
    r=assess_risk("my chest feels funny"); assert r["risk_level"]=="medium" and r["confidence"]=="low" and r["escalation_required"]

