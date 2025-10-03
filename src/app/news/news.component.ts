import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NewsItemComponent } from "./news-item.component";
import { NewsItem, NewsService } from '../services/news.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
  imports: [
    CommonModule,
    NewsItemComponent
]
})
export class NewsComponent implements OnInit, OnDestroy {
  constructor(
    private newsService: NewsService,
  ) { }

  private newsSubscription?: Subscription;
  newsItems: NewsItem[] = [];
  
  ngOnInit(): void {
    // Bootstrap to whatever was already loaded
    this.newsItems = this.newsService.newsItems;

    // Start polling for changes
    this.newsSubscription = this.newsService.pollNews().subscribe(a => this.newsItems = a);
  }

  ngOnDestroy(): void {
    this.newsSubscription?.unsubscribe();
  }
}
