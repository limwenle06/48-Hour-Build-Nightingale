from conftest import patient
from nightingale.app import ProfileItem, ProfileRevision

def test_medication_mutation_preserves_both_provenance_links(app,client):
    _,p,_=patient(client); ps=p["patient_session_id"]
    first=client.post(f"/api/patient/{ps}/messages",json={"content":"I take Advil."}).get_json()
    second=client.post(f"/api/patient/{ps}/messages",json={"content":"Actually I stopped last week."}).get_json()
    with app.app_context():
        item=ProfileItem.query.filter_by(patient_session_id=ps,kind="medication",value="Advil").one(); rev=ProfileRevision.query.filter_by(profile_item_id=item.id).order_by(ProfileRevision.recorded_at).all()
        assert item.status=="stopped" and item.provenance_pointer==second["message_id"]
        assert [x.status for x in rev]==["active","stopped"] and [x.provenance_pointer for x in rev]==[first["message_id"],second["message_id"]]

