from conftest import patient, login

def test_patient_a_cannot_fetch_patient_b_and_no_clinic_view(app):
    _,a,_=patient(client_email := app.test_client(),email="a@test.local")
    client_email.post('/logout')
    _,b,_=patient(other := app.test_client(),email="b@test.local")
    ps_a=a["patient_session_id"]; ps_b=b["patient_session_id"]
    assert other.get(f"/api/patient/{ps_a}/messages").status_code==403
    assert client_email.post("/login",json={"email":"a@test.local","password":"Secret123!"}).status_code==200
    assert client_email.get(f"/api/patient/{ps_b}/messages").status_code==403
    assert client_email.get("/clinic").status_code==403

def test_clinical_roles_can_access_consented_patient(app):
    owner=app.test_client(); _,p,_=patient(owner)
    for role in ("clinician","staff","nurse"):
        c=app.test_client(); login(c,f"{role}@demo.test")
        assert c.get(f"/api/patient/{p['patient_session_id']}/messages").status_code==200
        assert c.get("/clinic").status_code==200

