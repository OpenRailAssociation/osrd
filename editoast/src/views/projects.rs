use crate::error::Result;
use crate::DbPool;

use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, scope, Data, Json, Path};
use actix_web::{delete, get, patch, post, HttpResponse, Responder};

use crate::projects::ProjectData;
use crate::projects::{Project, ProjectPatch};

/// Returns `/projects` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects")
        .service((create, list))
        .service(scope("/{project}").service((get, delete, patch)))
}

#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<ProjectData>) -> Result<impl Responder> {
    let project = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Project::create(data.into_inner(), &mut conn)
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::Created().json(project))
}

/// Return a list of projects
#[get("")]
async fn list(db_pool: Data<DbPool>) -> Result<Json<Vec<Project>>> {
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(Project::list(&mut conn)))
    })
    .await
    .unwrap()
}

/// Return a specific project
#[get("")]
async fn get(db_pool: Data<DbPool>, project: Path<i64>) -> Result<Json<Project>> {
    let project = project.into_inner();
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(Project::retrieve(&mut conn, project)?))
    })
    .await
    .unwrap()
}

/// Delete a project
#[delete("")]
async fn delete(project: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra = project.into_inner();
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Project::delete(infra, &mut conn)?;

        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

#[patch("")]
pub async fn patch(
    data: Json<ProjectPatch>,
    project: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<Project>> {
    let project = project.into_inner();
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");

        Ok(Json(Project::update(
            data.into_inner(),
            &mut conn,
            project,
        )?))
    })
    .await
    .unwrap()
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

    pub fn create_project_request(
        name: &'static str,
        description: &'static str,
        objectives: &'static str,
    ) -> Request {
        TestRequest::post()
            .uri("/projects")
            .set_json(json!({ "name": name, "description":description, "objectives": objectives }))
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
        let response =
            call_service(&app, create_project_request("create_project_test", "", "")).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let project: Project = read_body_json(response).await;
        assert_eq!(project.name, "create_project_test");

        let response = call_service(&app, delete_project_request(project.id)).await;
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
        let project: Project =
            call_and_read_body_json(&app, create_project_request("get_project_test", "", "")).await;

        let req = TestRequest::get()
            .uri(format!("/projects/{}", project.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete()
            .uri(format!("/projects/{}", project.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_project_request(project.id)).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn project_patch() {
        let app = create_test_service().await;
        let project: Project =
            call_and_read_body_json(&app, create_project_request("get_project_test", "", "")).await;
        let req = TestRequest::put()
            .uri(format!("/projects/{}", project.id).as_str())
            .set_json(json!({"name": "rename_test", "budget":20000}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let response = call_service(&app, delete_project_request(project.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
