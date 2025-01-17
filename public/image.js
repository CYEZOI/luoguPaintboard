import { config } from "./config.js";

export class IMAGE {
    paintboard = document.getElementById('paintboardContainer').firstElementChild;
    imageInput = document.getElementById('imageInput');
    imageXInput = document.getElementById('imageXInput');
    imageYInput = document.getElementById('imageYInput');
    imageWidthInput = document.getElementById('imageWidthInput');
    imageHeightInput = document.getElementById('imageHeightInput');
    imageNameInput = document.getElementById('imageNameInput');
    imageButton = document.getElementById('imageButton');
    imageCanvas = document.getElementById('imageCanvas');
    image = new Image();

    constructor() {
        this.imageCanvas.width = config.pb.width;
        this.imageCanvas.height = config.pb.height;
    }


    redrawImage = () => {
        const ctx = this.imageCanvas.getContext('2d');
        ctx.drawImage(this.paintboard, 0, 0);
        ctx.drawImage(this.image,
            this.imageXInput.value, this.imageYInput.value,
            this.imageWidthInput.value, this.imageHeightInput.value);
    };

    registerEvent() {
        this.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            this.imageNameInput.value = file.name;
            if (file.size > config.server.bodyLimit * 1024 * 1024) {
                alert('文件大小不能超过20MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.image.src = e.target.result;
                this.image.onload = () => {
                    this.imageCanvas.hidden = false;
                    this.imageXInput.value = this.imageYInput.value = 0;
                    this.imageWidthInput.value = this.image.width;
                    this.imageHeightInput.value = this.image.height;
                    this.redrawImage();
                };
            };
            reader.readAsDataURL(file);
        });

        this.imageXInput.addEventListener('input', this.redrawImage);
        this.imageYInput.addEventListener('input', this.redrawImage);
        this.imageWidthInput.addEventListener('input', () => {
            this.imageHeightInput.value = this.imageWidthInput.value * this.image.height / this.image.width;
            this.redrawImage();
        });
        this.imageHeightInput.addEventListener('input', () => {
            this.imageWidthInput.value = this.imageHeightInput.value * this.image.width / this.image.height;
            this.redrawImage();
        });

        this.imageButton.addEventListener('click', () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.image.width
            tempCanvas.height = this.image.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(this.image, 0, 0);

            const name = this.imageNameInput.value;
            const image = tempCanvas.toDataURL('image/png');
            const scale = this.imageWidthInput.value / this.image.width;
            const initX = parseInt(this.imageXInput.value);
            const initY = parseInt(this.imageYInput.value);
            fetch('/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ name, image, scale, initX, initY }),
            }).then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }
                    this.imageCanvas.hidden = true;
                    this.imageInput.value =
                        this.imageXInput.value = this.imageYInput.value =
                        this.imageWidthInput.value = this.imageHeightInput.value =
                        this.imageNameInput.value = '';
                });
        });
    }
}

