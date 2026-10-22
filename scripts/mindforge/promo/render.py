#!/usr/bin/env python3
"""Render two original, bilingual 9:16 MindForge promo videos with neural dialogue.

This is an illustrative ad, not a recording of MindForge gameplay.  Narration uses
Microsoft Edge Neural voices through edge-tts. No API keys or proprietary media.
"""
from __future__ import annotations

import argparse
import asyncio
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import qrcode

W, H, FPS, LENGTH = 540, 960, 16, 30.0
COLORS = {'bg': '#0B1330', 'white': '#F7F8FF', 'mute': '#B5C7DE',
          'mint': '#73EAD5', 'violet': '#AD8AFF', 'pink': '#FF8EC5',
          'yellow': '#FFD775', 'navy': '#17264E'}
APP_URL = 'https://buianhtai.github.io/mindforge/?play=memory'
SCRIPT = {
 'en': {
   'voice': ('en-US-JennyNeural', 'en-US-GuyNeural'),
   'phrases': [(0.8, 0, 'AI, do everything for me!'),
               (5.6, 1, 'Wait... am I unemployed?!'),
               (10.3, 0, 'No way. Time for a brain workout!'),
               (17.4, 0, 'Quick! Where was the star?'),
               (23.9, 1, 'Yes! I still got it!'),
               (26.3, 0, 'MindForge. Use AI. Keep thinking.')],
   'titles': [('AI DOES', 'EVERYTHING.'), ('MEANWHILE...', 'MY BRAIN.'),
              ('PLOT TWIST:', 'BRAINS NEED REPS.'), ('MEMORY', 'CHALLENGE'),
              ('NICE WORK!', 'BRAIN POWER!'), ('MINDFORGE', 'TRAIN YOUR BRAIN')],
   'labels': ['100% PRODUCTIVE', 'Brain: on vacation', 'NO GYM REQUIRED',
              'Remember the symbols', 'Where was the star?', 'PLAY FOR FREE'],
   'countdown': 'WHERE WAS THE STAR?',
   'end': 'Use AI to work smarter.\nTrain your brain to stay sharp.'
 },
 'vi': {
   'voice': ('vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural'),
   'phrases': [(0.8, 0, 'AI ơi, làm hết giúp tôi đi!'),
               (5.6, 1, 'Ủa... tôi thất nghiệp rồi hả?!'),
               (10.3, 0, 'Không đâu! Tới giờ tập thể dục cho não rồi!'),
               (17.4, 0, 'Nhanh nào! Ngôi sao nằm ở đâu?'),
               (23.9, 1, 'Hay quá! Não vẫn còn đỉnh!'),
               (26.3, 0, 'MindForge. Dùng AI thông minh, đừng quên tập não!')],
   'titles': [('AI LÀM', 'HẾT MỌI THỨ!'), ('TRONG KHI ĐÓ...', 'NÃO CỦA TÔI...'),
              ('BẤT NGỜ CHƯA:', 'NÃO CŨNG CẦN TẬP!'), ('THỬ THÁCH', 'TRÍ NHỚ'),
              ('XUẤT SẮC!', 'NÃO VẪN ĐỈNH!'), ('MINDFORGE', 'LUYỆN NÃO MỖI NGÀY')],
   'labels': ['NĂNG SUẤT 100%', 'Não đang nghỉ phép', 'KHÔNG CẦN ĐẾN GYM',
              'Hãy nhớ các biểu tượng', 'Ngôi sao nằm ở đâu?', 'CHƠI MIỄN PHÍ'],
   'countdown': 'NGÔI SAO Ở ĐÂU?',
   'end': 'Dùng AI để làm việc thông minh.\nĐừng quên rèn luyện trí não!'
 }
}

def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def font(size, bold=True):
    files = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if bold else [
             '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for p in files:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def center(draw, text, y, size, color='white', max_width=490):
    text = text or ''
    while size >= 14:
        ft = font(size)
        box = draw.textbbox((0, 0), text, font=ft)
        if box[2] - box[0] <= max_width:
            break
        size -= 2
    draw.text(((W - (box[2] - box[0])) / 2, y), text,
              fill=COLORS.get(color,color), font=ft, stroke_width=0)

def roundbox(draw, xy, fill, radius=26, outline=None, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill,
                           outline=outline, width=width)

def brain(draw, x, y, tick, surprised=False, hero=False):
    bob = math.sin(tick*3)*8
    y += bob
    draw.ellipse((x-133,y-110,x+133,y+132), fill='#482959')
    for dx,dy,r in [(-57,-28,48),(-20,-66,48),(30,-61,49),(65,-25,47),
                    (55,30,50),(5,56,52),(-48,32,51)]:
        draw.ellipse((x+dx-r,y+dy-r,x+dx+r,y+dy+r), fill='#FF9FCB',outline='#FFCAE3',width=3)
    draw.line([(x,y-89),(x-4,y-33),(x+7,y+33),(x,y+95)], fill='#D75A9A',width=6)
    for sx in [-1,1]:
        ex=x+sx*45
        draw.ellipse((ex-8,y-5,ex+8,y+10),fill='#1A214A')
    if surprised:
        draw.ellipse((x-14,y+26,x+14,y+59),fill='#1A214A')
    else:
        draw.arc((x-35,y+5,x+35,y+65),start=10,end=170,fill='#1A214A',width=5)
    draw.line([(x-101,y+39),(x-135,y+83)],fill='#FF8EC5',width=10)
    draw.line([(x+101,y+39),(x+135,y+8)],fill='#FF8EC5',width=10)
    for sx in [-1,1]:
        draw.line([(x+sx*31,y+93),(x+sx*46,y+139)],fill='#FF8EC5',width=10)
    if hero:
        draw.polygon([(x-97,y+55),(x-144,y+160),(x+127,y+150),(x+95,y+45)],fill='#7B64F4')

def card(draw, x, y, symbol, face_up, chosen=False):
    fill='#284263' if face_up else '#25405A'
    outline='#72EAD6' if chosen else '#607B9F'
    roundbox(draw,(x,y,x+112,y+137),fill,18,outline,3)
    if face_up:
        draw.ellipse((x+17,y+25,x+95,y+104),fill='#433C6C')
        center_symbol=font(54)
        draw.text((x+56,y+66),symbol,font=center_symbol,fill='#FFE49B',anchor='mm')
    else:
        draw.text((x+56,y+68),'✦',font=font(38),fill='#73EAD5',anchor='mm')

def create_music(out_file):
    sr=22050
    n=int(sr*LENGTH)
    x=np.arange(n,dtype=np.float32)/sr
    wave=np.zeros(n,dtype=np.float32)
    chords=[(261.63,329.63,392),(220,329.63,440),(246.94,329.63,392),(196,293.67,392)]
    for bar in range(int(LENGTH//2)+1):
        begin=int(bar*2*sr);end=min(n,begin+int(2*sr))
        if begin>=end:continue
        local=np.arange(end-begin,dtype=np.float32)/sr
        chord=chords[bar%len(chords)]
        pad=sum(np.sin(2*np.pi*f*local) for f in chord)/3
        env=np.minimum(1,local*5)*np.minimum(1,(2-local)*4)
        wave[begin:end] += (pad*.065*env).astype(np.float32)
    for at in np.arange(0,LENGTH,.5):
        pos=int(at*sr);length=min(int(.10*sr),n-pos)
        if length<=0:continue
        v=np.arange(length,dtype=np.float32)/sr
        tone=np.sin(2*np.pi*(720 if int(at*2)%2 else 340)*v)
        wave[pos:pos+length]+=tone*np.exp(-v*52)*.065
    for at in [12.8,15.0,19.1,21.7,23.7]:
        pos=int(at*sr);length=min(int(.24*sr),n-pos)
        v=np.arange(length,dtype=np.float32)/sr
        wave[pos:pos+length]+=.14*np.sin(2*np.pi*(740+v*1300)*v)*np.exp(-v*16)
    wave=np.clip(wave,-.8,.8)
    import wave as wavmod
    with wavmod.open(str(out_file),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr)
        f.writeframes((wave*32767).astype('<i2').tobytes())

async def make_voices(conf,tmp,language,offline=False):
    if offline:return []
    import edge_tts
    tracks=[]
    for index,(time,who,words) in enumerate(conf['phrases']):
        path=tmp/f'voice_{language}_{index}.mp3'
        for attempt in range(3):
            try:
                await edge_tts.Communicate(words,voice=conf['voice'][who],rate='+4%').save(str(path))
                break
            except Exception:
                if attempt == 2:raise
                await asyncio.sleep((attempt+1)*3)
        if not path.exists() or path.stat().st_size<1000:
            raise RuntimeError(f'No audio for {language} line {index}')
        tracks.append((time,path))
    return tracks

def create_frames(conf, rawvideo):
    # The whole ad is original illustrative art, no live product UI is claimed.
    backgrounds={}
    for theme, color in [('navy',(10,18,45)),('violet',(25,18,55)),('teal',(9,38,53))]:
        a=np.zeros((H,W,3),dtype=np.uint8)
        for row in range(H):
            extra=int(16*math.sin(row/H*math.pi))
            a[row,:,:]=[min(255,v+extra) for v in color]
        backgrounds[theme]=Image.fromarray(a,mode='RGB')
    qr=qrcode.make(APP_URL).convert('RGB').resize((215,215))
    titles=conf['titles'];labels=conf['labels']
    with open(rawvideo,'wb') as output:
        for i in range(int(LENGTH*FPS)):
            t=i/FPS
            index=0 if t<4.7 else 1 if t<9.8 else 2 if t<13 else 3 if t<23.1 else 4 if t<26 else 5
            theme='navy' if index in (0,3,5) else 'violet' if index in (1,4) else 'teal'
            im=backgrounds[theme].copy();d=ImageDraw.Draw(im)
            for star in range(19):
                x=(star*137+19)%W;y=(star*191+57)%H
                d.ellipse((x,y,x+3,y+3),fill='#495679')
            roundbox(d,(18,19,184,62),'#273851',18)
            d.text((33,33),'✦ MINDFORGE',font=font(18),fill='#73EAD5')
            d.text((426,36),f'{int(t)+1:02d}/30',font=font(15),fill='#B5C7DE')
            center(d,titles[index][0],105,49,'white')
            center(d,titles[index][1],167,50,'mint' if index in (0,2,5) else 'pink')
            roundbox(d,(23,895,517,903),'#263452',5)
            roundbox(d,(23,895,23+494*t/LENGTH,903),'#73EAD5',5)
            if index==0:
                roundbox(d,(33,305,507,692),'#1D3155',27,'#50678A',3)
                for n,(txt,response) in enumerate([('Write my emails?','Done!'),('Plan my day?','Absolutely!'),('Think for me?','Of course!')]):
                    y=333+n*103
                    roundbox(d,(52,y,328,y+48),'#F3F7FF',17)
                    d.text((65,y+13),txt,font=font(18),fill='#17264E')
                    roundbox(d,(315,y+53,479,y+94),'#5D5EA4',17)
                    d.text((331,y+62),response,font=font(17),fill='white')
                center(d,labels[0],777,25,'yellow')
            elif index==1:
                roundbox(d,(66,668,477,793),'#613B7F',40)
                brain(d,268,523,t,surprised=t>6.1)
                if t<6.1:
                    center(d,'Z z z...',807,34,'violet')
                else:
                    roundbox(d,(48,799,492,864),'#352C61',20)
                    center(d,labels[1],813,25,'white')
            elif index==2:
                brain(d,255,506,t)
                d.line((327,396,461,396),fill='#F2F6FF',width=13)
                for x in [350,437]:roundbox(d,(x-18,350,x+18,441),'#9B82F4',10)
                center(d,labels[2],798,26,'yellow')
            elif index==3:
                visible=(t<15.25 or t>=19.7)
                symbols=['★','●','◆','♥','●','★','♥','◆']
                for j in range(8):
                    x=27+(j%4)*128;y=328+(j//4)*158
                    show=visible and (t<15.25 or j in (0,5))
                    card(d,x,y,symbols[j],show,chosen=t>=19.7 and j in (0,5))
                if t<15.25:
                    center(d,labels[3],716,27,'white')
                elif t<19.7:
                    center(d,conf['countdown'],714,24,'yellow')
                    center(d,str(max(1,math.ceil(19.7-t))),760,59,'mint')
                else:
                    center(d,'✓  MATCH!',741,39,'mint')
            elif index==4:
                brain(d,267,515,t,hero=True)
                for j in range(25):
                    x=(j*91+int(t*30))%W;y=(j*119+int((t-23)*160))%H
                    d.rectangle((x,y,x+7,y+10),fill=['#FFD775','#FF8EC5','#73EAD5'][j%3])
                center(d,labels[4],817,28,'yellow')
            else:
                roundbox(d,(136,309,404,580),'white',28)
                im.paste(qr,(163,337));d=ImageDraw.Draw(im)
                for n,line in enumerate(conf['end'].splitlines()):
                    center(d,line,622+n*45,20,'white')
                center(d,labels[5],779,29,'yellow')
                center(d,'buianhtai.github.io/mindforge',840,17,'mute')
            # Subtitle is synchronized to the approximate dialogue window.
            for k,(start,_,phrase) in enumerate(conf['phrases']):
                stop=conf['phrases'][k+1][0]-.3 if k+1<len(conf['phrases']) else 30
                if start<=t<min(start+3.0,stop) and index!=5:
                    roundbox(d,(26,844,514,887),'#071127',17)
                    center(d,phrase,855,18,'white',max_width=460)
            output.write(im.tobytes())

def assemble(rawvideo, music, voices, result):
    cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24',
         '-s',f'{W}x{H}','-r',str(FPS),'-i',str(rawvideo),'-i',str(music)]
    for _,file in voices:cmd+=['-i',str(file)]
    if voices:
        filters=[]
        tracks=[]
        for i,(at,_) in enumerate(voices,2):
            v=f'v{i}'
            filters.append(f'[{i}:a]aresample=44100,volume=1.5,adelay={int(at*1000)}|{int(at*1000)}[{v}]')
            tracks.append(f'[{v}]')
        filters.append(f'[1:a]aresample=44100,volume=0.36[bg]')
        filters.append('[bg]'+''.join(tracks)+f'amix=inputs={len(voices)+1}:duration=longest:normalize=0[a]')
        cmd+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]']
    else:
        cmd+=['-map','0:v','-map','1:a']
    cmd+=['-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p',
          '-c:a','aac','-b:a','160k','-t',str(LENGTH),'-movflags','+faststart',str(result)]
    run(*cmd)
    assert result.exists() and result.stat().st_size>150_000, f'Bad output: {result}'
    ff=subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_type',
                                 '-of','csv=p=0',str(result)],text=True)
    assert 'video' in ff and 'audio' in ff, 'Missing video or audio stream'
    print(f'Created {result} ({result.stat().st_size:,} bytes)')

async def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--language', choices=['en','vi','both'],default='both')
    ap.add_argument('--output-dir',default='dist/mindforge-promo')
    ap.add_argument('--offline',action='store_true',help='Generate visuals and music with no network narration')
    args=ap.parse_args()
    output=Path(args.output_dir);output.mkdir(parents=True,exist_ok=True)
    for lang in (['en','vi'] if args.language=='both' else [args.language]):
        with tempfile.TemporaryDirectory(prefix='mindforge-promo-') as tmp:
            t=Path(tmp)
            conf=SCRIPT[lang]
            voices=await make_voices(conf,t,lang,args.offline)
            music=t/'music.wav';create_music(music)
            raw=t/'video.rgb';create_frames(conf,raw)
            assemble(raw,music,voices,output/f'mindforge_promo_{lang}_natural.mp4')

if __name__=='__main__':
    asyncio.run(main())