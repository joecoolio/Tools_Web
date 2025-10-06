import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-load-more-button',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './load-more-button.component.html',
  styleUrl: './load-more-button.component.scss',
})
export class LoadMoreButtonMatComponent {
  @Input() loading = false;
  @Input() disabled = false;
  @Input() buttonText = "Load More";
  @Output() loadMore = new EventEmitter<void>();
  onClick() { if (!this.loading && !this.disabled) this.loadMore.emit(); }
}
