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

    imageList = document.getElementById('imageList');

    image = new Image();

    constructor() {
        this.imageCanvas.width = config.pb.width;
        this.imageCanvas.height = config.pb.height;
        this.fetchImageList();
        this.imageInput.addEventListener('change', this.handleImageInputChange);
        this.imageXInput.addEventListener('input', this.redrawImage);
        this.imageYInput.addEventListener('input', this.redrawImage);
        this.imageWidthInput.addEventListener('input', this.handleImageWidthInput);
        this.imageHeightInput.addEventListener('input', this.handleImageHeightInput);
        this.imageButton.addEventListener('click', this.handleImageButtonClick);
    }

    destroy = () => {
        this.imageInput.removeEventListener('change', this.handleImageInputChange);
        this.imageXInput.removeEventListener('input', this.redrawImage);
        this.imageYInput.removeEventListener('input', this.redrawImage);
        this.imageWidthInput.removeEventListener('input', this.handleImageWidthInput);
        this.imageHeightInput.removeEventListener('input', this.handleImageHeightInput);
        this.imageButton.removeEventListener('click', this.handleImageButtonClick);
        this.imageList.innerHTML = '';
    };

    redrawImage = () => {
        const ctx = this.imageCanvas.getContext('2d');
        ctx.drawImage(this.paintboard, 0, 0);
        ctx.drawImage(this.image,
            this.imageXInput.value, this.imageYInput.value,
            this.imageWidthInput.value, this.imageHeightInput.value);
    };

    handleImageInputChange = (e) => {
        const file = e.target.files[0];
        this.imageNameInput.value = file.name;
        if (file.size > config.server.bodyLimit * 1024 * 1024) {
            alert(`文件大小不能超过${config.server.bodyLimit}MB`);
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
    };

    handleImageWidthInput = () => {
        this.imageHeightInput.value = this.imageWidthInput.value * this.image.height / this.image.width;
        this.redrawImage();
    };

    handleImageHeightInput = () => {
        this.imageWidthInput.value = this.imageHeightInput.value * this.image.width / this.image.height;
        this.redrawImage();
    };

    handleImageButtonClick = () => {
        this.imageButton.disabled = true;

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
                    this.imageButton.disabled = false;
                    return;
                }
                this.imageCanvas.hidden = true;
                this.imageInput.value =
                    this.imageXInput.value = this.imageYInput.value =
                    this.imageWidthInput.value = this.imageHeightInput.value =
                    this.imageNameInput.value = '';
                this.imageButton.disabled = false;
                this.fetchImageList();
            })
            .catch(err => {
                this.imageButton.disabled = false;
            });
    };

    fetchImageList = () => {
        fetch('/image')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                this.imageList.innerHTML = '';
                for (const image of data) {
                    const imageElement = document.createElement('div'); this.imageList.appendChild(imageElement);
                    imageElement.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');

                    const left = document.createElement('div'); imageElement.appendChild(left);
                    left.innerHTML = `${image.name} ${(image.scale * 100).toFixed(2)}% (${image.init.x}, ${image.init.y})`;

                    const right = document.createElement('div'); imageElement.appendChild(right);
                    right.classList.add('btn-group');
                    const showButton = document.createElement('button'); right.appendChild(showButton);
                    showButton.classList.add('btn', 'btn-sm', 'btn-outline-primary');
                    showButton.innerText = '查看';
                    showButton.addEventListener('click', () => {
                        open(`/image/${image.id}`, '_blank');
                    });
                    const deleteButton = document.createElement('button'); right.appendChild(deleteButton);
                    deleteButton.classList.add('btn', 'btn-sm', 'btn-outline-danger');
                    deleteButton.innerText = '删除';
                    deleteButton.addEventListener('click', () => {
                        fetch(`/image/${image.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({}),
                        }).then(res => res.json())
                            .then(data => {
                                if (data.error) {
                                    alert(data.error);
                                    return;
                                }
                                this.fetchImageList();
                            });
                    });
                }
            });
    };
}

