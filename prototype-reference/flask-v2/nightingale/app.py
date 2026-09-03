import json, os, re, secrets, hashlib
from datetime import datetime, timezone, timedelta
from functools import wraps
from pathlib import Path
from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

def now(): return datetime.now(timezone.utc)
def uid(prefix): return f"{prefix}_{secrets.token_hex(8)}"

class Clinic(db.Model):
    id=db.Column(db.String,primary_key=True); name=db.Column(db.String,nullable=False)
class User(db.Model):
    id=db.Column(db.String,primary_key=True); email=db.Column(db.String,unique=True,nullable=False); phone=db.Column(db.String)
    password_hash=db.Column(db.String,nullable=False); role=db.Column(db.String,nullable=False,default="patient"); clinic_id=db.Column(db.String,db.ForeignKey("clinic.id"))
class LeadSession(db.Model):
    id=db.Column(db.String,primary_key=True); clinic_id=db.Column(db.String,db.ForeignKey("clinic.id"),nullable=False)
    source_channel=db.Column(db.String,nullable=False); campaign_id=db.Column(db.String); creative=db.Column(db.String); identity_level=db.Column(db.String,nullable=False)
    social_handle=db.Column(db.String); context=db.Column(db.String); landing_timestamp=db.Column(db.DateTime(timezone=True),default=now); recovery_token=db.Column(db.String,unique=True)
    converted_patient_session_id=db.Column(db.String); expires_at=db.Column(db.DateTime(timezone=True)); created_at=db.Column(db.DateTime(timezone=True),default=now)
class PatientSession(db.Model):
    id=db.Column(db.String,primary_key=True); user_id=db.Column(db.String,db.ForeignKey("user.id"),nullable=False); lead_session_id=db.Column(db.String,db.ForeignKey("lead_session.id"),unique=True)
    clinic_id=db.Column(db.String,db.ForeignKey("clinic.id"),nullable=False); created_at=db.Column(db.DateTime(timezone=True),default=now)
class Message(db.Model):
    id=db.Column(db.String,primary_key=True); lead_session_id=db.Column(db.String,db.ForeignKey("lead_session.id")); patient_session_id=db.Column(db.String,db.ForeignKey("patient_session.id"))
    role=db.Column(db.String,nullable=False); content=db.Column(db.Text,nullable=False); source_type=db.Column(db.String,default="text"); audio_transcript_id=db.Column(db.String)
    risk_level=db.Column(db.String); risk_reason=db.Column(db.String); confidence=db.Column(db.String); risk_provenance_at=db.Column(db.DateTime(timezone=True)); created_at=db.Column(db.DateTime(timezone=True),default=now)
class Consent(db.Model):
    id=db.Column(db.String,primary_key=True); user_id=db.Column(db.String,db.ForeignKey("user.id"),nullable=False); clinic_id=db.Column(db.String,db.ForeignKey("clinic.id"),nullable=False)
    consent_type=db.Column(db.String,nullable=False); granted=db.Column(db.Boolean,nullable=False); text_version=db.Column(db.String,nullable=False); recorded_at=db.Column(db.DateTime(timezone=True),default=now)
class ProfileItem(db.Model):
    id=db.Column(db.String,primary_key=True); patient_session_id=db.Column(db.String,db.ForeignKey("patient_session.id"),nullable=False); kind=db.Column(db.String,nullable=False)
    value=db.Column(db.String,nullable=False); status=db.Column(db.String,nullable=False,default="active"); provenance_pointer=db.Column(db.String,db.ForeignKey("message.id"),nullable=False); updated_at=db.Column(db.DateTime(timezone=True),default=now)
class ProfileRevision(db.Model):
    id=db.Column(db.String,primary_key=True); profile_item_id=db.Column(db.String,db.ForeignKey("profile_item.id"),nullable=False); value=db.Column(db.String,nullable=False)
    status=db.Column(db.String,nullable=False); provenance_pointer=db.Column(db.String,db.ForeignKey("message.id"),nullable=False); recorded_at=db.Column(db.DateTime(timezone=True),default=now)
class Citation(db.Model):
    id=db.Column(db.String,primary_key=True); message_id=db.Column(db.String,db.ForeignKey("message.id"),nullable=False); title=db.Column(db.String); url=db.Column(db.String); source_span=db.Column(db.Text)
class Escalation(db.Model):
    id=db.Column(db.String,primary_key=True); patient_session_id=db.Column(db.String,db.ForeignKey("patient_session.id"),nullable=False); trigger_message_id=db.Column(db.String,db.ForeignKey("message.id"),nullable=False)
    risk_level=db.Column(db.String,nullable=False); risk_reason=db.Column(db.String); triage_summary_json=db.Column(db.Text,nullable=False); profile_snapshot_json=db.Column(db.Text,nullable=False)
    provenance_json=db.Column(db.Text,nullable=False); attribution_json=db.Column(db.Text,nullable=False); status=db.Column(db.String,default="sent"); clinician_response=db.Column(db.Text); created_at=db.Column(db.DateTime(timezone=True),default=now)
class FunnelEvent(db.Model):
    id=db.Column(db.String,primary_key=True); lead_session_id=db.Column(db.String,db.ForeignKey("lead_session.id"),nullable=False); event_type=db.Column(db.String,nullable=False); metadata_json=db.Column(db.Text,default="{}"); created_at=db.Column(db.DateTime(timezone=True),default=now)
class AuditEvent(db.Model):
    id=db.Column(db.String,primary_key=True); actor_hash=db.Column(db.String); action=db.Column(db.String,nullable=False); object_type=db.Column(db.String); object_id=db.Column(db.String); metadata_json=db.Column(db.Text,default="{}"); created_at=db.Column(db.DateTime(timezone=True),default=now)

def audit(action,obj_type=None,obj_id=None,meta=None):
    actor=hashlib.sha256(str(session.get("user_id","guest")).encode()).hexdigest()[:12]
    db.session.add(AuditEvent(id=uid("aud"),actor_hash=actor,action=action,object_type=obj_type,object_id=obj_id,metadata_json=json.dumps(meta or {})))
def event(lead,kind,meta=None): db.session.add(FunnelEvent(id=uid("evt"),lead_session_id=lead.id,event_type=kind,metadata_json=json.dumps(meta or {})))

NAME=re.compile(r"(?i)\bmy name is\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+")
IC=re.compile(r"\b(?:\d{6}-?\d{2}-?\d{4}|[A-Z]\d{7}[A-Z])\b",re.I)
PHONE=re.compile(r"(?<!\w)(?:\+?6?01\d[- ]?\d{7,8})(?!\w)")
def redact_phi(text):
    if not isinstance(text,str): raise ValueError("redaction input unavailable")
    return PHONE.sub("[REDACTED]",IC.sub("[REDACTED]",NAME.sub("[REDACTED]",text)))

HIGH={"crushing chest pain":"possible cardiac emergency","difficulty breathing":"possible breathing emergency","heavy bleeding":"possible bleeding emergency","want to hurt myself":"possible self-harm emergency"}
AMBIG=["chest feels funny","chest feel funny","not sure if emergency","fainting","pass out"]
def assess_risk(text):
    t=text.lower()
    for phrase,reason in HIGH.items():
        if phrase in t: return {"risk_level":"high","risk_reason":reason,"confidence":"high","escalation_required":True}
    if any(x in t for x in AMBIG): return {"risk_level":"medium","risk_reason":"ambiguous symptom could be urgent; clinician review is safer","confidence":"low","escalation_required":True}
    if any(x in t for x in ["diagnose","what do i have","should i stop","dose","medication change"]): return {"risk_level":"medium","risk_reason":"request requires personalised clinical judgement","confidence":"med","escalation_required":True}
    return {"risk_level":"low","risk_reason":"no emergency pattern detected; this is not a diagnosis","confidence":"med","escalation_required":False}

def safe_response(text,risk,prior_user_messages=None):
    """Deterministic, one-question-at-a-time conversation after the risk gate."""
    if risk["risk_level"]=="high":
        return "This may be an emergency, and I can’t safely assess it here. Do not wait for Nightingale or the clinic. Exit Nightingale and dial 999 for Emergency Services now. Send to Clinic may be used only as an extra alert — not instead of emergency help."
    if risk["risk_level"]=="medium":
        return "A human should review this. I can’t safely assess it here. Send it to the clinic, or seek urgent help now if you feel worse or unsafe."
    lower=text.lower().strip(); prior_user_messages=prior_user_messages or []
    if "real doctor" in lower:
        return "No. I’m Nightingale AI, a software assistant — not a doctor. I can organise your concern. The clinic sees it only after you authenticate, consent, and send it. A human clinician reviews anything that needs clinical judgement."
    timeline=re.search(r"(?i)\b(?:for|since|started\s+)?((?:about\s+)?\d+\s+(?:hours?|days?|weeks?|months?)|last\s+(?:night|week|month|year)|yesterday|today)\b",text)
    if timeline and prior_user_messages:
        return f"Got it — {timeline.group(1)}. Is it getting better, worse, or staying the same?"
    if re.search(r"(?i)\b(?:getting|feels?)\s+(?:worse|better)|staying the same|no change\b",text):
        return "Thanks. How strong is it right now: mild, moderate, or severe?"
    if re.search(r"(?i)\b(?:mild|moderate|severe|\d+\s*(?:/|out of)\s*10)\b",text):
        return "Thanks. Is anything else happening with it?"
    concern=re.search(r"(?i)\b(?:i have|i've got|my)\s+([^.!?]{3,80})",text)
    if concern:
        return "Got it. When did it start?"
    if not prior_user_messages:
        return "Tell me what’s bothering you most."
    return "Thanks. What is the one thing you most want the clinic to understand?"

def extract_memory(psid,message):
    t=message.content; lower=t.lower(); changed=[]
    med=re.search(r"(?i)\b(?:i take|taking|on)\s+([A-Za-z][A-Za-z0-9-]{2,30})",t)
    if med:
        changed.append(upsert_profile(psid,"medication",med.group(1).title(),"active",message.id))
    if re.search(r"(?i)\b(?:actually\s+)?i stopped(?: taking)?(?: it|\s+([A-Za-z][A-Za-z0-9-]{2,30}))?(?:\s+last week)?",t):
        named=re.search(r"(?i)i stopped(?: taking)?\s+(?!last\b|yesterday\b|it\b)([A-Za-z][A-Za-z0-9-]{2,30})",t)
        q=ProfileItem.query.filter_by(patient_session_id=psid,kind="medication",status="active")
        item=q.filter(db.func.lower(ProfileItem.value)==named.group(1).lower()).first() if named else q.order_by(ProfileItem.updated_at.desc()).first()
        if item: changed.append(upsert_profile(psid,"medication",item.value,"stopped",message.id,item))
    allergy=re.search(r"(?i)\ballergic to\s+([^.,]+)",t)
    if allergy: changed.append(upsert_profile(psid,"allergy",allergy.group(1).strip(),"active",message.id))
    timeline=re.search(r"(?i)\b(?:for|since)\s+((?:about\s+)?\d+\s+(?:hours?|days?|weeks?|months?)|last\s+\w+)",t)
    symptom=re.search(r"(?i)\b(?:i have|i've had|experiencing|my)\s+([^.!?]{3,80})",t)
    if symptom and not med and "name is" not in lower:
        val=symptom.group(1).strip(); changed.append(upsert_profile(psid,"symptom",val,"active",message.id))
        if not ProfileItem.query.filter_by(patient_session_id=psid,kind="chief_complaint").first(): changed.append(upsert_profile(psid,"chief_complaint",val,"active",message.id))
    if timeline: changed.append(upsert_profile(psid,"timeline",timeline.group(1),"active",message.id))
    return changed

def upsert_profile(psid,kind,value,status,prov,item=None):
    item=item or ProfileItem.query.filter_by(patient_session_id=psid,kind=kind,value=value).first()
    if not item:
        item=ProfileItem(id=uid("mem"),patient_session_id=psid,kind=kind,value=value,status=status,provenance_pointer=prov); db.session.add(item); db.session.flush()
    else: item.value=value; item.status=status; item.provenance_pointer=prov; item.updated_at=now()
    db.session.add(ProfileRevision(id=uid("rev"),profile_item_id=item.id,value=value,status=status,provenance_pointer=prov)); return item

def current_user(): return db.session.get(User,session.get("user_id")) if session.get("user_id") else None
def login_required(fn):
    @wraps(fn)
    def w(*a,**kw):
        if not current_user(): abort(401)
        return fn(*a,**kw)
    return w
def roles(*allowed):
    def deco(fn):
        @wraps(fn)
        def w(*a,**kw):
            u=current_user()
            if not u: abort(401)
            if u.role not in allowed: abort(403)
            return fn(*a,**kw)
        return w
    return deco
def owned_ps(psid):
    ps=db.session.get(PatientSession,psid); u=current_user()
    if not ps: abort(404)
    if u.role=="patient" and ps.user_id!=u.id: abort(403)
    if u.role in ("staff","nurse","clinician") and ps.clinic_id!=u.clinic_id: abort(403)
    return ps

def create_app(test_config=None):
    app=Flask(__name__,instance_relative_config=True)
    app.config.update(SECRET_KEY=os.getenv("SECRET_KEY","dev-only-change-me"),SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL","sqlite:///nightingale.db"),SQLALCHEMY_TRACK_MODIFICATIONS=False)
    if test_config: app.config.update(test_config)
    db.init_app(app)
    rules=json.loads((Path(__file__).parent.parent/"channel_rules.json").read_text())
    app.config["CHANNEL_RULES"]=rules

    @app.get("/")
    def home(): return render_template("home.html",rules=rules)

    @app.post("/api/leads")
    def create_lead():
        d=request.get_json() or request.form; channel=d.get("source_channel","website_widget")
        if channel not in rules: return jsonify(error="unsupported channel"),400
        identity=d.get("identity_level") or rules[channel]["identity_levels"][0]
        lead=LeadSession(id=uid("lead"),clinic_id=d.get("clinic_id","clinic_demo"),source_channel=channel,campaign_id=d.get("campaign_id"),creative=d.get("creative"),identity_level=identity,social_handle=d.get("social_handle"),context=d.get("context","your concern"),recovery_token=secrets.token_urlsafe(20),expires_at=now()+timedelta(days=7))
        db.session.add(lead); event(lead,"visitor")
        opening=rules[channel]["opening"].format(context=lead.context or "your concern",platform=d.get("platform","social media"),campaign=lead.campaign_id or "health")
        db.session.commit(); session["lead_id"]=lead.id
        return jsonify(lead_id=lead.id,recovery_token=lead.recovery_token,opening=opening,simulated_channel=True)

    @app.post("/api/leads/<lid>/messages")
    def guest_message(lid):
        lead=db.session.get(LeadSession,lid)
        if not lead or session.get("lead_id")!=lid: abort(403)
        text=(request.get_json() or {}).get("content","").strip()
        if not text: return jsonify(error="message required"),400
        if Message.query.filter_by(lead_session_id=lid,role="user").count()>=20: return jsonify(error="guest rate limit reached"),429
        msg=Message(id=uid("gmsg"),lead_session_id=lid,role="user",content=text); db.session.add(msg)
        if not FunnelEvent.query.filter_by(lead_session_id=lid,event_type="conversation_started").first(): event(lead,"conversation_started")
        risk=assess_risk(text); msg.risk_level=risk["risk_level"]; msg.risk_reason=risk["risk_reason"]; msg.confidence=risk["confidence"]; msg.risk_provenance_at=now()
        prior=[m.content for m in Message.query.filter_by(lead_session_id=lid,role="user").filter(Message.id!=msg.id).order_by(Message.created_at).all()]
        response=safe_response(redact_phi(text),risk,prior)
        ai=Message(id=uid("gmsg"),lead_session_id=lid,role="assistant",content=response,risk_level=risk["risk_level"],confidence=risk["confidence"]); db.session.add(ai)
        event(lead,"value_event",{"type":"concern_organiser"}); audit("guest_message_processed","LeadSession",lid,{"risk":risk["risk_level"]}); db.session.commit()
        trust=None if risk["risk_level"]=="high" else "Continue without repeating yourself."
        return jsonify(message_id=msg.id,response=response,risk=risk,trust_transition=trust,next_action="call_999" if risk["risk_level"]=="high" else "clinic_review" if risk["risk_level"]=="medium" else "continue")

    @app.post("/api/auth/start")
    def auth_start():
        lead=db.session.get(LeadSession,(request.get_json() or {}).get("lead_id"));
        if not lead or session.get("lead_id")!=lead.id: abort(403)
        event(lead,"auth_started"); db.session.commit(); return jsonify(status="verification_demo_ready",note="Email verification is simulated in this prototype.")

    @app.post("/api/auth/complete")
    def auth_complete():
        d=request.get_json() or {}; lead=db.session.get(LeadSession,d.get("lead_id"))
        if not lead or session.get("lead_id")!=lead.id: abort(403)
        if not d.get("consent"): return jsonify(error="Clinic sharing consent is required"),400
        if not d.get("email") or not d.get("phone") or not d.get("password"): return jsonify(error="email, phone and password required"),400
        user=User.query.filter_by(email=d["email"].lower()).first()
        if user and not check_password_hash(user.password_hash,d["password"]): return jsonify(error="invalid authentication"),401
        if not user: user=User(id=uid("usr"),email=d["email"].lower(),phone=d["phone"],password_hash=generate_password_hash(d["password"]),role="patient",clinic_id=lead.clinic_id); db.session.add(user)
        ps=PatientSession.query.filter_by(lead_session_id=lead.id).first()
        if not ps:
            ps=PatientSession(id=uid("ps"),user_id=user.id,lead_session_id=lead.id,clinic_id=lead.clinic_id); db.session.add(ps); db.session.flush()
            for m in Message.query.filter_by(lead_session_id=lead.id,role="user").all(): extract_memory(ps.id,m)
            lead.converted_patient_session_id=ps.id; event(lead,"consented"); event(lead,"patient_created")
            db.session.add(Consent(id=uid("con"),user_id=user.id,clinic_id=lead.clinic_id,consent_type="healthcare_share",granted=True,text_version="v1-demo-clinic"))
        session.clear(); session["user_id"]=user.id; audit("lead_converted","PatientSession",ps.id,{"lead_id":lead.id}); db.session.commit()
        return jsonify(patient_session_id=ps.id,redirect=url_for("patient_chat",psid=ps.id))

    @app.get("/patient/<psid>")
    @login_required
    def patient_chat(psid):
        ps=owned_ps(psid); msgs=Message.query.filter((Message.patient_session_id==ps.id)|(Message.lead_session_id==ps.lead_session_id)).order_by(Message.created_at).all(); profile=ProfileItem.query.filter_by(patient_session_id=ps.id).all()
        return render_template("chat.html",ps=ps,messages=msgs,profile=profile)

    @app.post("/api/patient/<psid>/messages")
    @login_required
    def patient_message(psid):
        ps=owned_ps(psid); d=request.get_json() or {}; text=d.get("content","").strip()
        if not text: return jsonify(error="message required"),400
        risk=assess_risk(text); msg=Message(id=uid("pmsg"),patient_session_id=ps.id,role="user",content=text,risk_level=risk["risk_level"],risk_reason=risk["risk_reason"],confidence=risk["confidence"],risk_provenance_at=now()); db.session.add(msg); db.session.flush()
        extract_memory(ps.id,msg); redacted=redact_phi(text)
        prior=[m.content for m in Message.query.filter_by(patient_session_id=ps.id,role="user").filter(Message.id!=msg.id).order_by(Message.created_at).all()]
        response=safe_response(redacted,risk,prior)
        ai=Message(id=uid("pmsg"),patient_session_id=ps.id,role="assistant",content=response,risk_level=risk["risk_level"],confidence=risk["confidence"]); db.session.add(ai)
        audit("patient_message_processed","PatientSession",ps.id,{"risk":risk["risk_level"],"redaction_applied":redacted!=text}); db.session.commit()
        return jsonify(message_id=msg.id,response=response,risk=risk,profile=profile_json(ps.id))

    @app.post("/api/patient/<psid>/escalate")
    @login_required
    def escalate(psid):
        ps=owned_ps(psid); d=request.get_json() or {}; trigger=db.session.get(Message,d.get("trigger_message_id"))
        if not trigger or trigger.patient_session_id!=ps.id: return jsonify(error="valid triggering message required"),400
        consent=Consent.query.filter_by(user_id=ps.user_id,clinic_id=ps.clinic_id,consent_type="healthcare_share",granted=True).first()
        if not consent: abort(403)
        existing=Escalation.query.filter_by(patient_session_id=ps.id,trigger_message_id=trigger.id).first()
        if existing: return jsonify(escalation_id=existing.id,status=existing.status,duplicate=True)
        lead=db.session.get(LeadSession,ps.lead_session_id); prof=profile_json(ps.id); prov=[{"profile_item_id":x["id"],"message_id":x["provenance_pointer"]} for x in prof]
        summary=[f"Patient reported: {redact_phi(trigger.content)[:160]}",f"Safety gate: {trigger.risk_level} — {trigger.risk_reason}"]
        attr={k:getattr(lead,k) for k in ["clinic_id","source_channel","campaign_id","creative","identity_level","landing_timestamp"]}; attr["landing_timestamp"]=attr["landing_timestamp"].isoformat()
        esc=Escalation(id=uid("esc"),patient_session_id=ps.id,trigger_message_id=trigger.id,risk_level=trigger.risk_level or "medium",risk_reason=trigger.risk_reason,triage_summary_json=json.dumps(summary),profile_snapshot_json=json.dumps(prof),provenance_json=json.dumps(prov),attribution_json=json.dumps(attr)); db.session.add(esc); event(lead,"escalation_sent"); audit("escalation_sent","Escalation",esc.id,{"risk":esc.risk_level}); db.session.commit()
        confirmation=("The clinic has received this urgent alert. Do not wait for a reply—exit Nightingale and dial 999 for Emergency Services now." if esc.risk_level=="high" else "Sent to Demo Women’s Clinic for review. Response times vary. Seek urgent help now if you feel worse or unsafe.")
        return jsonify(escalation_id=esc.id,status="sent",confirmation=confirmation)

    @app.get("/api/patient/<psid>/messages")
    @login_required
    def messages_api(psid):
        ps=owned_ps(psid); return jsonify([{"id":m.id,"role":m.role,"content":m.content} for m in Message.query.filter_by(patient_session_id=ps.id).all()])

    @app.post("/login")
    def login():
        d=request.get_json() or request.form; u=User.query.filter_by(email=d.get("email","").lower()).first()
        if not u or not check_password_hash(u.password_hash,d.get("password","")): return jsonify(error="invalid authentication"),401
        session.clear(); session["user_id"]=u.id; return jsonify(role=u.role,redirect=url_for("clinic_dashboard") if u.role!="patient" else "/")

    @app.post("/logout")
    def logout(): session.clear(); return redirect(url_for("home"))

    @app.get("/clinic")
    @roles("staff","nurse","clinician")
    def clinic_dashboard():
        u=current_user(); esc=Escalation.query.join(PatientSession).filter(PatientSession.clinic_id==u.clinic_id).order_by(Escalation.created_at.desc()).all(); leads=LeadSession.query.filter_by(clinic_id=u.clinic_id).all()
        metrics={}
        for l in leads:
            m=metrics.setdefault(l.source_channel,{"visitors":0,"value_events":0,"patients":0,"escalations":0}); m["visitors"]+=1
            types=[x.event_type for x in FunnelEvent.query.filter_by(lead_session_id=l.id).all()]; m["value_events"]+=types.count("value_event"); m["patients"]+=types.count("patient_created"); m["escalations"]+=types.count("escalation_sent")
        warm=[]
        for l in leads:
            types=[x.event_type for x in FunnelEvent.query.filter_by(lead_session_id=l.id).all()]; high=Message.query.filter_by(lead_session_id=l.id,risk_level="high").first()
            if not high and l.converted_patient_session_id: high=Message.query.filter_by(patient_session_id=l.converted_patient_session_id,risk_level="high").first()
            if not high:
                score=app.config["CHANNEL_RULES"][l.source_channel]["weight"]+10*len(types)+(15 if l.identity_level!="anonymous" else 0)
                warm.append({"lead":l,"score":score,"reason":f"channel {app.config['CHANNEL_RULES'][l.source_channel]['weight']} + stage {10*len(types)} + identity {15 if l.identity_level!='anonymous' else 0}"})
        warm.sort(key=lambda x:x["score"],reverse=True)
        return render_template("clinic.html",escalations=esc,metrics=metrics,warm=warm)

    @app.post("/api/staff/referrals")
    @roles("staff","nurse","clinician")
    def referral():
        d=request.get_json() or {}; lead=LeadSession(id=uid("lead"),clinic_id=current_user().clinic_id,source_channel="staff_referral",campaign_id="care_team_handoff",creative="personal_link",identity_level="staff_context",context=d.get("context","follow-up topic"),recovery_token=secrets.token_urlsafe(20),expires_at=now()+timedelta(days=7)); db.session.add(lead); event(lead,"visitor"); db.session.commit()
        return jsonify(url=url_for("recover",token=lead.recovery_token,_external=True),simulated_delivery=True)

    @app.get("/r/<token>")
    def recover(token):
        lead=LeadSession.query.filter_by(recovery_token=token).first_or_404()
        if lead.expires_at.replace(tzinfo=timezone.utc)<now(): return "This secure continuation link has expired.",410
        session["lead_id"]=lead.id; rule=rules[lead.source_channel]; opening=rule["opening"].format(context=lead.context,platform="social media",campaign=lead.campaign_id or "health")
        messages=Message.query.filter_by(lead_session_id=lead.id).order_by(Message.created_at).all()
        last_user=next((m for m in reversed(messages) if m.role=="user"),None)
        return render_template("guest.html",lead=lead,opening=opening,messages=messages,recovered_risk=last_user.risk_level if last_user else None)

    @app.get("/demo/<channel>")
    def demo(channel):
        if channel not in rules: abort(404)
        lead=LeadSession(id=uid("lead"),clinic_id="clinic_demo",source_channel=channel,campaign_id=request.args.get("campaign","ivf_over40"),creative=request.args.get("creative","demo"),identity_level=rules[channel]["identity_levels"][0],context=request.args.get("context","fertility options"),social_handle=request.args.get("handle"),recovery_token=secrets.token_urlsafe(20),expires_at=now()+timedelta(days=7)); db.session.add(lead); event(lead,"visitor"); db.session.commit(); session["lead_id"]=lead.id
        opening=rules[channel]["opening"].format(context=lead.context,platform=request.args.get("platform","Instagram"),campaign=lead.campaign_id)
        return redirect(url_for("recover",token=lead.recovery_token))

    @app.get("/health")
    def health(): return jsonify(status="ok",mode="deterministic_safe_demo")

    with app.app_context(): db.create_all(); seed()
    return app

def profile_json(psid):
    return [{"id":p.id,"kind":p.kind,"value":p.value,"status":p.status,"provenance_pointer":p.provenance_pointer,"updated_at":p.updated_at.isoformat()} for p in ProfileItem.query.filter_by(patient_session_id=psid).all()]

def seed():
    if not db.session.get(Clinic,"clinic_demo"): db.session.add(Clinic(id="clinic_demo",name="Demo Women’s Clinic"))
    for role,email in [("clinician","clinician@demo.test"),("staff","staff@demo.test"),("nurse","nurse@demo.test")]:
        if not User.query.filter_by(email=email).first(): db.session.add(User(id=uid("usr"),email=email,phone="+60100000000",password_hash=generate_password_hash("Demo123!"),role=role,clinic_id="clinic_demo"))
    db.session.commit()

if __name__=="__main__": create_app().run(debug=True)
