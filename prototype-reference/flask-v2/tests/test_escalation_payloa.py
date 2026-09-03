import json
from conftest import patient
from nightingale.app import Escalation, FunnelEvent

def test_escalation_payload_is_complete(app,client):
    l,p,_=patient(client); ps=p["patient_session_id"]
    m=client.post(f"/api/patient/{ps}/messages",json={"content":"I have crushing chest pain."}).get_json()
    r=client.post(f"/api/patient/{ps}/escalate",json={"trigger_message_id":m["message_id"]}); assert r.status_code==200
    with app.app_context():
        e=app.extensions["sqlalchemy"].session.get(Escalation,r.get_json()["escalation_id"])
        assert e.trigger_message_id==m["message_id"] and json.loads(e.triage_summary_json)
        assert isinstance(json.loads(e.profile_snapshot_json),list) and isinstance(json.loads(e.provenance_json),list)
        a=json.loads(e.attribution_json); assert a["source_channel"]=="instagram_ad_click" and a["campaign_id"]=="ivf_over40"
        assert FunnelEvent.query.filter_by(lead_session_id=l["lead_id"],event_type="escalation_sent").first()
