from conftest import patient
from nightingale.app import LeadSession, PatientSession, ProfileItem, Message, FunnelEvent

def test_guest_to_patient_conversion(app,client):
    l,p,g=patient(client,concern="I have pelvic discomfort for 2 weeks")
    with app.app_context():
        lead=app.extensions["sqlalchemy"].session.get(LeadSession,l["lead_id"]); ps=app.extensions["sqlalchemy"].session.get(PatientSession,p["patient_session_id"])
        assert lead.source_channel=="instagram_ad_click" and lead.campaign_id=="ivf_over40"
        assert ps.lead_session_id==lead.id and lead.converted_patient_session_id==ps.id
        item=ProfileItem.query.filter_by(patient_session_id=ps.id,kind="chief_complaint").first(); guest=Message.query.filter_by(lead_session_id=lead.id,role="user").first()
        assert item and item.provenance_pointer==guest.id
        assert {x.event_type for x in FunnelEvent.query.filter_by(lead_session_id=lead.id)} >= {"visitor","conversation_started","value_event","auth_started","consented","patient_created"}
