from conftest import lead
from nightingale.app import FunnelEvent

def test_generated_value_event_is_tracked(app,client):
    l=lead(client); r=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"What should I ask at a fertility consultation?"})
    assert r.status_code==200 and r.get_json()["response"]
    with app.app_context():
        rows=FunnelEvent.query.filter_by(lead_session_id=l["lead_id"],event_type="value_event").all()
        assert len(rows)==1 and "concern_organiser" in rows[0].metadata_json

def test_no_fake_statistic_in_value_message(client):
    l=lead(client); d=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":"Is this common?"}).get_json()
    assert "people asked" not in d["response"]

