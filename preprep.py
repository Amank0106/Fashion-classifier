
from PIL import Image,ImageOps


from torchvision import transforms

transform=transforms.Compose([
     transforms.Grayscale(num_output_channels=1),
    transforms.Resize((28, 28)),
    transforms.ToTensor(),
    transforms.Lambda(lambda x: 1 - x),
    transforms.Normalize((0.2860),(.3530)),
])


def preprocess(image):
    image=image.convert('RGB')
    image=transform(image)
    image=image.unsqueeze(0)
    return image
