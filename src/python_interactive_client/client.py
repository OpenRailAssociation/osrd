#!/usr/bin/env python3

import asyncio
import websockets
import json

async def hello():
    async with websockets.connect("ws://localhost:9000/websockets/chat/tesetset") as websocket:
        message = {"to": "truc", "content": "ok"}
        await websocket.send(json.dumps(message))
        print(await websocket.recv())

asyncio.run(hello())
