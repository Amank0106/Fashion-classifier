from io import BytesIO

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from model import cnn
from preprep import preprocess

app = FastAPI()

model = cnn()
state = torch.load("fashion2.pth", map_location="cpu", weights_only=True)
model.load_state_dict(state)
model.eval()

classes = [
    "T-shirt/top", "Trouser", "Pullover",
    "Dress", "Coat", "Sandal", "Shirt",
    "Sneaker", "Bag", "Ankle boot",
]

MAX_BYTES = 5 * 1024 * 1024


@app.get("/")
def root():
    return FileResponse("frontend/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


# The frontend sends the upload under the form key "file".
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image is larger than 5 MB")

    try:
        img = Image.open(BytesIO(contents))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Invalid image")

    try:
        x = preprocess(img)

        with torch.inference_mode():
            output = model(x)
            probabilities = torch.softmax(output, dim=1)
            confidence, prediction = torch.max(probabilities, dim=1)

        class_id = prediction.item()
        return {
            "prediction": classes[class_id],
            "class_id": class_id,
            "confidence": round(confidence.item() * 100, 2),
            "class_image": f"/static/classes/{class_id}.png",
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Prediction failed")


# Mounted last so it never shadows the API routes.
app.mount("/static", StaticFiles(directory="frontend"), name="static")