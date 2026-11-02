import torch
import torch.nn as nn
class cnn(nn.Module):
    def __init__(self):
        super().__init__()
        self.cv=nn.Sequential(
            nn.Conv2d(1,32,kernel_size=3,padding='same'),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            
            nn.MaxPool2d(kernel_size=2,stride=2),
            
            nn.Conv2d(32,64,kernel_size=3,padding='same'),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2,stride=2)
        )

        self.fc=nn.Sequential(
            nn.Flatten(),
            nn.Linear(64*7*7,128),
            nn.ReLU(),
            nn.Linear(128,64),
            nn.ReLU(),
            nn.Linear(64,10)
        )
    def forward(self,x):
            data=self.cv(x)
            data=self.fc(data)
            return data
            