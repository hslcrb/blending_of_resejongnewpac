"""Validate installed sky animation and live timer without saving the file."""
import bpy, sys, datetime, time, json
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
root=Path.cwd();spec=spec_from_file_location('weather_sky',str(root/'scripts/seoul_weather_sky.py'));m=module_from_spec(spec);spec.loader.exec_module(m)
text=bpy.data.texts.get('Seoul weather live.py')
assert text and text.as_string()==(root/'scripts/seoul_weather_sky.py').read_text(encoding='utf8')
for scene in bpy.data.scenes:
    bpy.context.window.scene=scene
    assert scene.get('seoul_weather_sky_axis') in {'local','seoul'}, scene.name
    assert (scene.frame_start,scene.frame_end)==(1,145),scene.name
    sun=scene.objects.get(scene['seoul_weather_sun']);fill=scene.objects.get(scene['seoul_weather_night_fill'])
    assert sun and fill and sun.data.type=='SUN' and fill.data.type=='SUN',scene.name
    assert scene.world and all(scene.world.node_tree.nodes.get(name) for name in ('Seoul solar atmosphere','Seoul cloud coverage','Seoul clouds','Seoul weather background')),scene.name
    scene.frame_set(1);night=sun.data.energy
    scene.frame_set(73);noon=sun.data.energy
    scene.frame_set(145);last=sun.data.energy
    assert night<.001 and last<.001 and noon>.1,(scene.name,night,noon,last)
    m.apply(scene,datetime.datetime.now(m.KST),{'fraction':1,'observedAt':'test','cover':'OVC'})
    cloudy=scene.world.node_tree.nodes['Seoul cloud coverage'].color_ramp.elements[0].position
    m.apply(scene,datetime.datetime.now(m.KST),None)
    clear=scene.world.node_tree.nodes['Seoul cloud coverage'].color_ramp.elements[0].position
    assert cloudy<clear and scene['seoul_weather_status'].startswith('관측 미확인'),scene.name
print('VALID_SCENES',len(bpy.data.scenes),flush=True)
if '--test-live' in sys.argv:
    now=datetime.datetime.now(datetime.timezone.utc);ts=now.isoformat()
    data={'station':'RKSS','observedAt':ts,'cover':'FEW','clouds':[{'cover':'OVC'}]}
    assert m.parse_weather(data)['fraction']==1
    assert m.parse_weather({'station':'XXXX','observedAt':ts,'cover':'CAVOK'}) is None
    stale=(now-datetime.timedelta(hours=3)).isoformat()
    assert m.parse_weather({'station':'RKSS','observedAt':stale,'cover':'CAVOK'}) is None
    actual=m.fetch_weather(); print('WEATHER_FETCH',json.dumps(actual,ensure_ascii=False),flush=True)
    test_scene=bpy.context.scene;test_scene.frame_set(73);reference=test_scene.objects[test_scene['seoul_weather_sun']].data.energy
    m.fetch_weather=lambda: m.parse_weather(data)
    m.start_live();timer=bpy.app.driver_namespace['seoul_weather_live_timer']
    assert bpy.app.timers.is_registered(timer);timer();time.sleep(.3);timer()
    assert bpy.context.scene['seoul_weather_cover']=='OVC'
    test_scene.frame_set(73);cloud_sun=test_scene.objects[test_scene['seoul_weather_sun']].data.energy
    assert cloud_sun < reference*.5,(cloud_sun,reference)
    m.stop_live();assert not bpy.app.timers.is_registered(timer)
    print('TIMER_TEST PASS',flush=True)
