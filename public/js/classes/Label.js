export const LabelPlugin = {
    labels: [],
    init() {
        // empty init
    },
    add(l) {
        this.labels.push(l);
    },
    remove(l) {
        this.labels = this.labels.filter(label => label !== l);
    },
    render(scene, cam) {
        for (let i = 0; i < this.labels.length; i++) {
            this.labels[i].render(scene, cam);
        }
    },
    find(obj) {
        for (let i = 0; i < this.labels.length; i++) {
            if (this.labels[i].object === obj) {
                return this.labels[i];
            }
        }
        return null;
    }
};
// Patch THREE.WebGLRenderer and THREE.CanvasRenderer
// const OriginalWebGLRenderer = THREE.WebGLRenderer;
// THREE.WebGLRenderer = function (parameters) {
//     const orig = new OriginalWebGLRenderer(parameters);
//     orig.addPostPlugin(LabelPlugin);
//     return orig;
// };
// const OriginalCanvasRenderer = THREE.CanvasRenderer;
// THREE.CanvasRenderer = function (parameters) {
//     const orig = new OriginalCanvasRenderer(parameters);
//     orig.addPostPlugin(LabelPlugin);
//     return orig;
// };
export default class Label {
    constructor(object, content, className, align = 'center', duration) {
        this.show = true;
        this.object = object;
        this.content = content;
        this.className = className;
        this.align = align;
        if (duration) {
            this.remove(duration);
        }
        this.el = this.buildElement();
        LabelPlugin.add(this);
    }
    buildElement() {
        const el = document.createElement('div');
        el.textContent = this.content;
        el.className = this.className;
        el.style.maxWidth = (window.innerWidth * 0.25) + 'px';
        el.style.maxHeight = (window.innerHeight * 0.25) + 'px';
        document.body.appendChild(el);
        return el;
    }
    render(scene, cam) {
        if (!this.show) {
            this.el.style.display = 'none';
            return;
        }
        this.object.updateMatrix();
        this.object.updateMatrixWorld();
        cam.updateMatrix();
        cam.updateMatrixWorld();
        const p3d = new THREE.Vector3();
        p3d.setFromMatrixPosition(this.object.matrixWorld);
        const frustum = new THREE.Frustum();
        const cameraViewProjectionMatrix = new THREE.Matrix4();
        cameraViewProjectionMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);
        const onScreen = frustum.containsPoint(p3d);
        if (onScreen) {
            // Deprecated THREE.Projector is replaced by Vector3.project(camera)
            const pos = p3d.project(cam);
            const width = window.innerWidth;
            const height = window.innerHeight;
            const w = this.el.offsetWidth;
            const h = this.el.offsetHeight;
            let margin = 0;
            switch (this.align) {
                case 'left':
                    margin = 0;
                    break;
                case 'right':
                    margin = w;
                    break;
                case 'center':
                    margin = w / 2;
                    break;
            }
            this.el.style.top = `${height / 2 - (height / 2) * pos.y - h}px`;
            this.el.style.left = `${(width / 2) * pos.x + width / 2 - margin}px`;
            this.el.style.display = 'block';
        }
        else {
            this.el.style.display = 'none';
        }
    }
    setContent(content) {
        this.content = content;
        this.el.textContent = this.content;
    }
    remove(delay) {
        if (delay) {
            return window.setTimeout(() => this.remove(), delay * 1000);
        }
        if (this.el.parentNode === document.body) {
            document.body.removeChild(this.el);
        }
        LabelPlugin.remove(this);
    }
}
//# sourceMappingURL=Label.js.map