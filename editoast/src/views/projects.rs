use crate::error::Result;
use crate::models::Document;
use crate::projects::{Project, ProjectPatchForm};
use crate::projects::{ProjectCreateForm, ProjectWithStudies};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, scope, Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
struct ProjectWithImageUrl {
    image_url: Option<String>,
    #[serde(flatten)]
    project: ProjectWithStudies,
}

impl From<ProjectWithStudies> for ProjectWithImageUrl {
    fn from(project: ProjectWithStudies) -> Self {
        let image_url = project.project.image.unwrap().map(Document::get_url);
        ProjectWithImageUrl { project, image_url }
    }
}

/// Returns `/projects` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects")
        .service((create, list))
        .service(scope("/{project}").service((get, delete, patch)))
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ProjectCreateForm>,
) -> Result<Json<ProjectWithImageUrl>> {
    let data = data.into_inner();
    let project = Project::create(data, db_pool).await?;

    Ok(Json(project.into()))
}

/// Return a list of projects
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<ProjectWithImageUrl>>> {
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let projects = Project::list(db_pool, page, per_page).await?;

    Ok(Json(projects.into()))
}

/// Return a specific project
#[get("")]
async fn get(db_pool: Data<DbPool>, project: Path<i64>) -> Result<Json<ProjectWithImageUrl>> {
    let project = project.into_inner();
    let project = Project::retrieve(db_pool.clone(), project).await?;
    Ok(Json(project.into()))
}

/// Delete a project
#[delete("")]
async fn delete(project: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let project = project.into_inner();
    Project::delete(project, db_pool).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[patch("")]
async fn patch(
    data: Json<ProjectPatchForm>,
    project: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<ProjectWithImageUrl>> {
    let project = project.into_inner();
    let project = Project::update(data.into_inner(), db_pool, project).await?;
    Ok(Json(project.into()))
}

#[cfg(test)]
mod test {
    use crate::projects::Project;
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, read_body_json, TestRequest};
    use serde_json::json;

    pub fn create_project_request() -> Request {
        TestRequest::post()
            .uri("/projects")
            .set_json(json!({ "name": "test","description": "", "objectives":"" }))
            .to_request()
    }

    pub fn delete_project_request(project_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/projects/{project_id}").as_str())
            .to_request()
    }

    #[actix_test]
    async fn project_create_delete() {
        let app = create_test_service().await;
        let response = call_service(&app, create_project_request()).await;
        assert_eq!(response.status(), StatusCode::OK);
        let project: Project = read_body_json(response).await;
        assert_eq!(project.name.unwrap(), "test");
        let response = call_service(&app, delete_project_request(project.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn project_list() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/projects/").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[actix_test]
    async fn project_get() {
        let app = create_test_service().await;
        let project: Project = call_and_read_body_json(&app, create_project_request()).await;

        let req = TestRequest::get()
            .uri(format!("/projects/{}", project.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete()
            .uri(format!("/projects/{}", project.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_project_request(project.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn project_patch() {
        let app = create_test_service().await;
        let project: Project = call_and_read_body_json(&app, create_project_request()).await;
        let req = TestRequest::patch()
            .uri(format!("/projects/{}", project.id.unwrap()).as_str())
            .set_json(json!({"name": "rename_test", "budget":20000}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let response = call_service(&app, delete_project_request(project.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
