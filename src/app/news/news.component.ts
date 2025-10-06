import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NewsItemComponent } from "./news-item.component";
import { NewsItem, NewsService } from '../services/news.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { LoadMoreButtonMatComponent } from "../shared/load-more-button.component";

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
  imports: [
    CommonModule,
    NewsItemComponent,
    LoadMoreButtonMatComponent
  ]
})
export class NewsComponent implements OnInit, OnDestroy {
  constructor(
    private newsService: NewsService,
  ) { }

  private newsSubscription?: Subscription;
  newsItems: NewsItem[] = [];
  itemsLoaded: boolean = false; // Set to true after something comes back from the service

  ngOnInit(): void {
    // Bootstrap to whatever was already loaded
    this.newsItems = this.newsService.newsItems;

    // Start polling for changes
    this.newsSubscription = this.newsService.pollNews().subscribe(a => {
      this.newsItems = a
      this.itemsLoaded = true;
    });
  }

  ngOnDestroy(): void {
    this.newsSubscription?.unsubscribe();
  }

  // Button at the bottom to load more data
  loadingMore = false;
  async loadMore() {
    this.loadingMore = true;
    try {
      await firstValueFrom(this.newsService.loadOlder()).then(a => this.newsItems = a);
    } finally {
      this.loadingMore = false;
    }
  }
}
