import { Directive, Input, HostListener, ElementRef } from '@angular/core';

// A resize directive used to resize 2 divs next to each other.
// Modified version of: https://mohitshah13398.medium.com/resizing-flex-items-with-angular-directives-9a2873f0bd2e

@Directive({
    selector: '[appResize]'
})
export class ResizeDirective {
    @Input('parentContainer') parentContainer!: HTMLElement;
    @Input('leftResize') leftElement!: HTMLElement;
    @Input('rightResize') rightElement!: HTMLElement;

    grabber: boolean = false;

    constructor(private el: ElementRef<HTMLElement>) { }

    @HostListener('mousedown') onMouseDown() {
        this.grabber = true;
        this.el.nativeElement.classList.add('side-panel');
        document.body.style.cursor = 'e-resize';
    }

    @HostListener('window:mouseup') onMouseUp() {
        this.grabber = false;
        this.el.nativeElement.classList.remove('side-panel');
        document.body.style.cursor = 'default';
    }

    @HostListener('window:mousemove', ['$event']) onMouseMove(event: MouseEvent) {
        if (this.grabber) {
            event.preventDefault();
            if (event.movementX > 0) {
                this.rightElement.style.flex = `0 5 ${(this.parentContainer.clientWidth || window.screen.availWidth) - event.clientX}px`;
                this.leftElement.style.flex = `1 5 ${event.clientX - 16}px`;
            } else {
                this.leftElement.style.flex = `0 5 ${event.clientX - 16}px`;
                this.rightElement.style.flex = `1 5 ${(this.parentContainer.clientWidth || window.screen.availWidth) - event.clientX}px`;
            }
        }
    }
}