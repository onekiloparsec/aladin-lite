pub mod query;
pub mod request;

use crate::renderable::Url;
use std::collections::HashSet;

use query::QueryId;

pub struct Downloader {
    // Current requests
    requests: Vec<RequestType>,
    queried_list: HashSet<QueryId>,

    cache: Cache<Url, Resource>,
    queried_cached_urls: Vec<Url>,
}

use crate::fifo_cache::Cache;

use query::Query;
use request::{RequestType, Resource};


impl Downloader {
    pub fn new() -> Downloader {
        let requests = Vec::with_capacity(32);
        let queried_list = HashSet::with_capacity(64);
        let cache = Cache::new();
        let queried_cached_urls = Vec::with_capacity(64);
        Self {
            requests,
            queried_list,
            cache,
            queried_cached_urls,
        }
    }
    // Returns true if the fetch has been done
    // Returns false if the query has already been done
    pub fn fetch<T>(&mut self, query: T) -> bool
    where
        T: Query,
    {
        let url = query.url();
        if self.cache.contains(url) {
            self.queried_cached_urls.push(url.clone());
            false
        } else {
            let query_id = query.id();

            let not_already_requested = !self.queried_list.contains(&query_id);

            // The cell is not already requested
            if not_already_requested {
                self.queried_list.insert(query_id);
    
                let request = T::Request::from(query);
                self.requests.push(request.into());
            }
    
            not_already_requested
        }
    }

    pub fn get_received_resources(&mut self) -> Vec<Resource> {
        let mut rscs = vec![];

        let mut finished_query_list = vec![];
        self.requests = self
            .requests
            .drain(..)
            .filter(|request| {
                // If the request resolves into a resource
                if let Some(rsc) = request.into() {
                    rscs.push(rsc);
                    finished_query_list.push(request.id().clone());

                    false
                // The request is not resolved, we keep it
                } else {
                    true
                }
            })
            .collect();

        for query_id in finished_query_list.into_iter() {
            self.queried_list.remove(&query_id);
        }

        while let Some(url) = self.queried_cached_urls.pop() {
            if let Some(rsc) = self.cache.extract(&url) {
                rscs.push(rsc);
            }
        }

        rscs
    }

    pub fn cache_rsc(&mut self, rsc: Resource) {
        self.cache.insert(rsc.url().clone(), rsc);
    }

    pub fn delay_rsc(&mut self, rsc: Resource) {
        self.queried_cached_urls.push(rsc.url().clone());
        self.cache.insert(rsc.url().clone(), rsc);
    }
}
