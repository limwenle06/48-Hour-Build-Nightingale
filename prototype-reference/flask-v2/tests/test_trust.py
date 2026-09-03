from conftest import lead

def test_honest_ai_identity_and_handoff_boundary(client):
    l=lead(client,channel="social_comment",identity_level="social_handle",social_handle="synthetic_user")
    d=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"Are you a real doctor?"}).get_json(); text=d["response"]
    assert "No." in text and "software assistant" in text and "not a doctor" in text and "after you authenticate, consent, and send it" in text and "human clinician" in text

