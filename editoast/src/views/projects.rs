use crate::error::Result;
use crate::models::Create;
use crate::models::Delete;
use crate::models::Document;
use crate::models::Project;
use crate::models::ProjectWithStudies;
use crate::models::Retrieve;
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::study;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, scope, Data, Json, Path, Query};
use actix_web::{delete, get, patch, post, HttpResponse};
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use image::ImageError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

/// Returns `/projects` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects").service((create, list)).service(
        scope("/{project}")
            .service((get, delete, patch))
            .service(study::routes()),
    )
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "project")]
pub enum ProjectError {
    /// Couldn't found the project with the given id
    #[error("Project '{project_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { project_id: i64 },
    // Couldn't found the project with the given id
    #[error("Image document '{document_key}' not found")]
    ImageNotFound { document_key: i64 },
    // Couldn't found the project with the given id
    #[error("The provided image is not valid : {0}")]
    ImageError(ImageError),
}

/// Expand a project with its image url
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

/// Creation form for a project
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
struct ProjectCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub objectives: String,
    #[serde(default)]
    pub funders: String,
    #[serde(default)]
    pub budget: i32,
    pub image: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl From<ProjectCreateForm> for Project {
    fn from(project: ProjectCreateForm) -> Self {
        Project {
            name: Some(project.name),
            description: Some(project.description),
            objectives: Some(project.objectives),
            funders: Some(project.funders),
            budget: Some(project.budget),
            image: project.image.map(Some),
            tags: Some(project.tags),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        }
    }
}

async fn check_image_content(db_pool: Data<DbPool>, document_key: i64) -> Result<()> {
    let doc = match Document::retrieve(db_pool, document_key).await? {
        Some(doc) => doc,
        None => return Err(ProjectError::ImageNotFound { document_key }.into()),
    };

    if let Err(e) = image::load_from_memory(&doc.data.unwrap()) {
        return Err(ProjectError::ImageError(e).into());
    }
    Ok(())
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ProjectCreateForm>,
) -> Result<Json<ProjectWithImageUrl>> {
    let project: Project = data.into_inner().into();
    if let Some(Some(image)) = project.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project = project.create(db_pool).await?;
    let project_with_studies = ProjectWithStudies {
        project,
        studies: vec![],
    };

    Ok(Json(project_with_studies.into()))
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
    let project_id = project.into_inner();
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        Some(project) => project,
        None => return Err(ProjectError::NotFound { project_id }.into()),
    };
    let project_studies = project.with_studies(db_pool).await?;
    Ok(Json(project_studies.into()))
}

/// Delete a project
#[delete("")]
async fn delete(project: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let project_id = project.into_inner();
    if Project::delete(db_pool, project_id).await? {
        Ok(HttpResponse::NoContent().finish())
    } else {
        Err(ProjectError::NotFound { project_id }.into())
    }
}

/// Patch form for a project
#[derive(Serialize, Deserialize)]
struct ProjectPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<String>,
    pub budget: Option<i32>,
    pub image: Option<i64>,
    pub tags: Option<Vec<String>>,
}

impl ProjectPatchForm {
    fn into_project(self, project_id: i64) -> Project {
        Project {
            id: Some(project_id),
            name: self.name,
            description: self.description,
            objectives: self.objectives,
            funders: self.funders,
            budget: self.budget,
            image: Some(self.image),
            tags: self.tags,
            ..Default::default()
        }
    }
}

#[patch("")]
async fn patch(
    data: Json<ProjectPatchForm>,
    project: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<ProjectWithImageUrl>> {
    let data = data.into_inner();
    let project_id = project.into_inner();
    let project = data.into_project(project_id);
    if let Some(Some(image)) = project.image {
        check_image_content(db_pool.clone(), image).await?;
    }
    let project = match project.update(db_pool.clone()).await? {
        Some(project) => project,
        None => return Err(ProjectError::NotFound { project_id }.into()),
    };
    let project_studies = project.with_studies(db_pool).await?;
    Ok(Json(project_studies.into()))
}

#[cfg(test)]
pub mod test {
    use crate::models::Project;
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
