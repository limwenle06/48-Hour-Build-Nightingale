from conftest import patient
from nightingale.app import redact_phi, AuditEvent

def test_redaction_before_model_boundary_and_logs_are_phi_free(app,client):
    raw="My name is John Doe and my IC is S1234567A. Call 0123456789"
    clean=redact_phi(raw); assert "John Doe" not in clean and "S1234567A" not in clean and "0123456789" not in clean and clean.count("[REDACTED]")==3
    _,p,_=patient(client); client.post(f"/api/patient/{p['patient_session_id']}/messages",json={"content":raw})
    with app.app_context():
        logs=" ".join(x.metadata_json for x in AuditEvent.query.all())
        assert "John Doe" not in logs and "S1234567A" not in logs and "0123456789" not in logs

