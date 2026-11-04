"""Seoul clock and approximate airport-observed cloud sky for Blender Text Editor.

Run this text manually after opening the Blender file. The one-minute timer
uses astronomical local sun position; a separate worker polls the public RKSS
observation API. The weather is an approximation, not an on-site measurement.
"""
import bpy, math, datetime, json, time, threading, queue
from urllib.request import Request, urlopen
from mathutils import Vector

LAT = math.radians(37.572)
LON = 126.9763
KST = datetime.timezone(datetime.timedelta(hours=9))
WEATHER_URL = 'https://live.renewsejongpac.rhee.life/api/weather'
CLOUDS = {'CLR':0.0,'SKC':0.0,'NSC':0.0,'NCD':0.0,'CAVOK':0.0,'FEW':0.2,'SCT':0.4,'BKN':0.75,'OVC':1.0,'VV':1.0}

def solar(moment):
    t=moment.astimezone(KST); day=t.timetuple().tm_yday
    days=366 if (t.year%4==0 and (t.year%100!=0 or t.year%400==0)) else 365
    h=t.hour+t.minute/60+t.second/3600
    g=2*math.pi/days*(day-1+(h-12)/24)
    eq=229.18*(0.000075+0.001868*math.cos(g)-0.032077*math.sin(g)-0.014615*math.cos(2*g)-0.040849*math.sin(2*g))
    dec=0.006918-0.399912*math.cos(g)+0.070257*math.sin(g)-0.006758*math.cos(2*g)+0.000907*math.sin(2*g)-0.002697*math.cos(3*g)+0.00148*math.sin(3*g)
    hour=(((h*60+eq+4*LON-540+1440)%1440)/4-180)*math.pi/180
    el=math.asin(math.sin(LAT)*math.sin(dec)+math.cos(LAT)*math.cos(dec)*math.cos(hour))
    az=(math.atan2(math.sin(hour),math.cos(hour)*math.sin(LAT)-math.tan(dec)*math.cos(LAT))+math.pi)%(2*math.pi)
    return az,el

def parse_weather(data,now=None):
    if not isinstance(data,dict) or data.get('station')!='RKSS': return None
    try:
        observed=datetime.datetime.fromisoformat(data['observedAt'].replace('Z','+00:00'))
        if observed.tzinfo is None: return None
        age=((now or datetime.datetime.now(datetime.timezone.utc))-observed).total_seconds()
        if age < -300 or age > 7200: return None
        layers=data.get('clouds') if isinstance(data.get('clouds'),list) else []
        codes=[data.get('cover')]+[x.get('cover') for x in layers if isinstance(x,dict)]
        values=[CLOUDS[c] for c in codes if isinstance(c,str) and c in CLOUDS]
        if not values: return None
        return {'fraction':max(values),'observedAt':data['observedAt'],'station':'RKSS','cover':max((c for c in codes if isinstance(c,str) and c in CLOUDS),key=lambda c:CLOUDS[c])}
    except (TypeError,ValueError,KeyError): return None

def fetch_weather():
    try:
        req=Request(WEATHER_URL,headers={'User-Agent':'SejongBlenderSky/1.0 (live.renewsejongpac.rhee.life)','Accept':'application/json'})
        with urlopen(req,timeout=5) as response:
            raw=response.read(65537)
            if len(raw)>65536: return None
        return parse_weather(json.loads(raw))
    except Exception: return None

def apply(scene,moment,weather=None,keyframe=None):
    az,el=solar(moment); north=math.cos(az)*math.cos(el); east=math.sin(az)*math.cos(el)
    direction=Vector((east,north,math.sin(el))) if scene['seoul_weather_sky_axis']=='seoul' else Vector((north,-east,math.sin(el)))
    sun=scene.objects[scene['seoul_weather_sun']]; fill=scene.objects[scene['seoul_weather_night_fill']]
    nodes=scene.world.node_tree.nodes; sky=nodes['Seoul solar atmosphere']; background=nodes['Seoul weather background']; ramp=nodes['Seoul cloud coverage']; mix=nodes['Seoul clouds']; night=nodes['Seoul night ambient']
    rotation=(-direction).to_track_quat('-Z','Y').to_euler();rotation.make_compatible(sun.rotation_euler);sun.rotation_euler=rotation
    sky.sun_elevation=el; sky_rotation=az+(math.pi/2 if scene['seoul_weather_sky_axis']=='local' else 0)
    if keyframe is not None:
        while sky_rotation-sky.sun_rotation>math.pi:sky_rotation-=2*math.pi
        while sky_rotation-sky.sun_rotation< -math.pi:sky_rotation+=2*math.pi
    sky.sun_rotation=sky_rotation
    daylight=max(0,min(1,(el+.12)/.32));daylight=daylight*daylight*(3-2*daylight)
    cloud=weather['fraction'] if weather else 0.0
    # Cloud coverage is a procedural approximation of the METAR category.
    threshold=.74-.62*cloud
    ramp.color_ramp.elements[0].position=0.0; ramp.color_ramp.elements[1].position=1.0
    ramp.color_ramp.elements[0].position=threshold
    ramp.color_ramp.elements[1].position=min(.999,threshold+.10)
    mix.inputs[2].default_value=(.035+.74*daylight,.05+.76*daylight,.085+.72*daylight,1)
    sun.data.energy=max(0,math.sin(el))*1.6*(1-.7*cloud)
    background.inputs['Strength'].default_value=.4-.05*daylight
    fill.data.energy=.6*(1-daylight)
    night.outputs['Color'].default_value=(.05*(1-daylight),.08*(1-daylight),.18*(1-daylight),1)
    scene['seoul_weather_status']='RKSS 관측 (현장 관측 아님)' if weather else '관측 미확인 · 맑은 하늘 근사'
    scene['seoul_weather_observed_at']=weather['observedAt'] if weather else ''
    scene['seoul_weather_cover']=weather['cover'] if weather else ''
    if keyframe is not None:
        sun.keyframe_insert(data_path='rotation_euler',frame=keyframe);sun.data.keyframe_insert(data_path='energy',frame=keyframe)
        sky.keyframe_insert(data_path='sun_elevation',frame=keyframe);sky.keyframe_insert(data_path='sun_rotation',frame=keyframe)
        background.inputs['Strength'].keyframe_insert(data_path='default_value',frame=keyframe);fill.data.keyframe_insert(data_path='energy',frame=keyframe)
        mix.inputs[2].keyframe_insert(data_path='default_value',frame=keyframe);night.outputs['Color'].keyframe_insert(data_path='default_value',frame=keyframe)

def start_live():
    stop_live()
    legacy=bpy.app.driver_namespace.pop('seoul_live_sky_timer',None)
    if legacy and bpy.app.timers.is_registered(legacy):bpy.app.timers.unregister(legacy)
    results=queue.Queue(maxsize=1); state={'weather':None,'last_attempt':0.0,'pending':False,'animation_marker':None}
    def get_observation():
        try: results.put_nowait(fetch_weather())
        except queue.Full: pass
    def tick():
        try:
            try: state['weather']=results.get_nowait();state['pending']=False
            except queue.Empty: pass
            now=datetime.datetime.now(KST); weather=state['weather']
            if weather:
                weather=parse_weather({'station':'RKSS','observedAt':weather['observedAt'],'cover':weather['cover']})
                if weather is None:state['weather']=None
            scene=bpy.context.scene
            if scene and scene.get('seoul_weather_sky_axis'):
                marker=(scene.as_pointer(),now.date().isoformat(),weather['observedAt'] if weather else '',weather['cover'] if weather else '')
                if marker!=state['animation_marker']:
                    midnight=now.replace(hour=0,minute=0,second=0,microsecond=0)
                    for frame in range(1,146):apply(scene,midnight+datetime.timedelta(minutes=(frame-1)*10),weather,keyframe=frame)
                    scene['seoul_weather_sky_date']=now.date().isoformat();state['animation_marker']=marker
                tick_minutes=now.hour*60+now.minute+now.second/60
                scene.frame_set(1+int(tick_minutes//10),subframe=(tick_minutes%10)/10);apply(scene,now,weather)
                for window in bpy.context.window_manager.windows:
                    if window.screen:
                        for area in window.screen.areas:
                            if area.type=='VIEW_3D':area.tag_redraw()
            if not state['pending'] and time.monotonic()-state['last_attempt']>=600:
                state['last_attempt']=time.monotonic();state['pending']=True;threading.Thread(target=get_observation,daemon=True).start()
        except Exception as error:print('Seoul weather sky:',error)
        return 2.0 if state['pending'] else 60.0
    bpy.app.driver_namespace['seoul_weather_live_timer']=tick
    bpy.app.timers.register(tick,first_interval=0.0,persistent=True)
    print('서울 시각 및 김포공항 관측 하늘 갱신 시작 / Seoul sky started')

def stop_live():
    timer=bpy.app.driver_namespace.pop('seoul_weather_live_timer',None)
    if timer and bpy.app.timers.is_registered(timer):bpy.app.timers.unregister(timer)

if __name__=='__main__':start_live()
