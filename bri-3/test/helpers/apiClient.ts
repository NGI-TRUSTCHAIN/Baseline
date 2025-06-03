import * as request from 'supertest';

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {}

  async get<T>(path: string, query?: Record<string, any>): Promise<T> {
    const req = request(this.baseUrl)
      .get(path)
      .set('Authorization', `Bearer ${this.accessToken}`);

    if (query) {
      req.query(query);
    }

    const response = await req.expect(200);
    return JSON.parse(response.text);
  }

  async post(path: string, data: any): Promise<string> {
    const response = await request(this.baseUrl)
      .post(path)
      .set('Authorization', `Bearer ${this.accessToken}`)
      .send(data)
      .expect(201);
    return response.text;
  }

  async put<T>(path: string, data: any): Promise<T> {
    const response = await request(this.baseUrl)
      .put(path)
      .set('Authorization', `Bearer ${this.accessToken}`)
      .send(data)
      .expect(200);
    return JSON.parse(response.text);
  }
}
