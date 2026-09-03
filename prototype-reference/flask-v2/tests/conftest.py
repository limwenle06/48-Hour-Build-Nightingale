import pytest
from nightingale.app import create_app, db, Clinic, User
from werkzeug.security import generate_password_hash

@pytest.fixture()
def app(tmp_path):
    app=create_app({"TESTING":True,"SECRET_KEY":"test","SQLALCHEMY_DATABASE_URI":f"sqlite:///{tmp_path/'test.db'}"})
    yield app

@pytest.fixture()
def client(app): return app.test_client()

def lead(client,channel="instagram_ad_click",**kw):
    data={"source_channel":channel,"clinic_id":"clinic_demo","campaign_id":"ivf_over40","creative":"story_a","context":"fertility options"}|kw
    r=client.post("/api/leads",json=data); assert r.status_code==200; return r.get_json()

def patient(client,email="patient@example.test",concern="I have headaches for 3 days"):
    l=lead(client); gm=client.post(f"/api/leads/{l['lead_id']}/messages",json={"content":concern}); assert gm.status_code==200
    client.post("/api/auth/start",json={"lead_id":l["lead_id"]})
    r=client.post("/api/auth/complete",json={"lead_id":l["lead_id"],"email":email,"phone":"+60112223333","password":"Secret123!","consent":True}); assert r.status_code==200
    return l,r.get_json(),gm.get_json()

def login(client,email,password="Demo123!"):
    r=client.post("/login",json={"email":email,"password":password}); assert r.status_code==200; return r

